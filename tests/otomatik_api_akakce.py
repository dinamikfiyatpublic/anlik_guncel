import os
import time
import logging
import psycopg2
import requests
from urllib.parse import quote_plus

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# GitHub token (GitHub Actions ortamında otomatik tanımlıdır)
github_token = os.getenv('MY_GITHUB_TOKEN')

# PostgreSQL connection details (bunlar da Actions Secrets'tan geliyor olacak)
db_user = os.getenv('PG_DB_USER')
db_password = os.getenv('PG_PASSWORD')
db_host = os.getenv('PG_HOST')
db_port = os.getenv('PG_PORT')
db_name = os.getenv('PG_NAME')
viewName = os.getenv('PG_VIEW_NAME')

# Encode the password for safe use in connection string
encoded_password = quote_plus(db_password)

# PostgreSQL connection string
connection_string = f"postgresql://{db_user}:{encoded_password}@{db_host}:{db_port}/{db_name}"

# Function to get the count of links
def check_supabase():
    try:
        with psycopg2.connect(connection_string) as conn:
            with conn.cursor() as cur:
                logging.info('Connected to the database.')
                cur.execute(f"""SELECT COUNT(*) as count
                    FROM {viewName}
                    WHERE checker = true""")
                result = cur.fetchone()
                scrape_kalan = result[0] if result else 0
                logging.info(f"kalan adet sorgu: {scrape_kalan}")
                return scrape_kalan
    except Exception as e:
        logging.error(f"Failed to execute the query: {e}")
        return None

# Function to trigger a GitHub workflow
def trigger_workflow(workflow_name):
    response = requests.post(
        f"https://api.github.com/repos/dinamikfiyatpublic/anlik_guncel/actions/workflows/{workflow_name}/dispatches",
        json={"ref": "main"},
        headers={"Authorization": f"token {github_token}"}
    )
    if response.status_code == 204:
        logging.info(f"Workflow '{workflow_name}' triggered successfully.")
        time.sleep(5)  # Wait for a few seconds after triggering
    else:
        logging.error(f"Failed to trigger workflow '{workflow_name}': {response.status_code} - {response.text}")
    return response

def check_running_workflows():
    # Get all running workflows
    response = requests.get(
        "https://api.github.com/repos/dinamikfiyatpublic/anlik_guncel/actions/runs",
        headers={"Authorization": f"token {github_token}"}
    )
    if response.status_code != 200:
        logging.error(f"Failed to fetch running workflows: {response.status_code} - {response.text}")
        return []
    
    runs = response.json().get("workflow_runs", [])
    return [run for run in runs if run["status"] == "in_progress"]

def wait_for_workflow_completion(workflow_name):
    while True:
        running_workflows = check_running_workflows()
        logging.info(f"Current running workflows: {[run['name'] for run in running_workflows]}")
        if not any(run['name'] == workflow_name for run in running_workflows):
            logging.info(f"'{workflow_name}' has finished running.")
            return
        else:
            logging.info(f"'{workflow_name}' is still running. Waiting to retry.")
            time.sleep(10)  # Wait and recheck

def main():
    first_run = True  # Track if it's the first run

    # Only one workflow now
    workflow_mapping = {
        "concurrent_run_test_matrix.mjs": "concurrent_run_api_matrix.yml"
    }

    while True:
        # Check for any running workflows before proceeding
        running_workflows = check_running_workflows()
        running_workflow_names = [run['name'] for run in running_workflows]
        logging.info(f"Currently running workflows: {running_workflow_names}")

        # Check if there are relevant workflows running
        relevant_running_workflows = [
            run for run in running_workflows if run['name'] in workflow_mapping
        ]

        if not relevant_running_workflows:
            logging.info("No specified workflows found running.")

            logging.info("Checking scrape_kalan value.")
            scrape_kalan = check_supabase()
            if scrape_kalan is None:
                logging.error("Failed to fetch scrape_kalan from Supabase. Skipping workflow re-trigger.")
                continue

            if scrape_kalan > 0:
                if first_run:
                    # For the first run, only trigger 'concurrent_run_api_matrix.yml'
                    logging.info("First run: triggering 'concurrent_run_api_matrix.yml' workflow.")
                    trigger_workflow("concurrent_run_api_matrix.yml")
                    wait_for_workflow_completion("concurrent_run_test_matrix.mjs")  # Wait for this workflow to finish
                    first_run = False  # First run is done now
                else:
                    # For subsequent runs, trigger the concurrent run again
                    logging.info(f"scrape_kalan is {scrape_kalan}. Triggering 'concurrent_run_api_matrix.yml' workflow.")
                    trigger_workflow("concurrent_run_api_matrix.yml")
                    wait_for_workflow_completion("concurrent_run_test_matrix.mjs")
            else:
                logging.info("No more rows to process. Exiting.")
                return

        else:
            # If there are relevant workflows running, just log and wait
            logging.info("Relevant workflows are currently running. Waiting before re-checking.")
            time.sleep(10)  # Wait before re-checking

        # Optional: sleep between full cycles to prevent rapid looping
        time.sleep(60)  # Wait before checking again

if __name__ == "__main__":
    main()
