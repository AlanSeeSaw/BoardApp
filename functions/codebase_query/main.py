import os
import json
import subprocess
from dotenv import load_dotenv
import time
import sys
import shutil
from .system_prompts import PROMPT
from typing import Literal
load_dotenv()

def download_repo(repo_url: str, target_dir: str) -> bool:
    """Clones a git repository into the target directory. Returns True on success."""
    if os.path.exists(target_dir):
        print(f"Directory {target_dir} already exists. Removing it.")
        shutil.rmtree(target_dir)

    print(f"Cloning repository {repo_url} into {target_dir}...")
    cmd = ["git", "clone", repo_url, target_dir]
    
    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True, # Raise exception on non-zero exit code
            timeout=300
        )
        print(f"Repository cloned successfully.")
        return True
    except Exception as e:
        print(f"An unexpected error occurred during git clone: {e}")
        return False
    
def run_codex(card: str, dir_name: str) -> dict | str | None:
    prompt = PROMPT.replace("{DIR_NAME}", dir_name).replace("{CARD}", card)
    cmd = [
        "codex", 
        "-a", 
        "full-auto", 
        "--json", 
        "-q", 
        prompt
    ]

    print(f"Running Codex with prompt: {prompt}")
    
    os.environ["CODEX_QUIET_MODE"] = "1"
    
    # Execute and capture stdout/stderr
    result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=os.environ.copy(),
    )

    # Check if the command failed
    if result.returncode != 0:
        print(f"Error running Codex. Exit code: {result.returncode}")
        print(f"Command: {' '.join(cmd)}")
        print(f"Stderr:\n{result.stderr}")
        print(f"Stdout:\n{result.stdout}")
        return None  # Indicate failure

    print(f"Result: {result.stdout}")
    # Process the JSON stream output
    last_message = None
    for line in result.stdout.strip().splitlines():
        data = json.loads(line)
        if data.get("type") == "message" and data.get("status") == "completed":
            last_message = data # Keep track of the latest completed message
            
    # print(f"\n\n\nLast message: {last_message}\n\n\n")
            
    last_message_content = last_message["content"][0]["text"]
    
    # Clean up the content by removing markdown code block fences if present
    if last_message_content.startswith("```json\n"):
        # Extract JSON content between the markdown fences
        content_parts = last_message_content.split("```")
        if len(content_parts) >= 2:
            last_message_content = content_parts[1].strip()
            if last_message_content.startswith("json\n"):
                last_message_content = last_message_content[5:].strip()
    
    last_message = json.loads(last_message_content)
    print(f"\n\n\nOutput: {last_message}\n\n\n")

    return last_message

def run_claude(card: str, dir_name: str) -> dict | str | None:
    prompt = PROMPT.replace("{DIR_NAME}", dir_name).replace("{CARD}", card)
    cmd = [
        "claude",              # global CLI executable
        "-p", prompt,          # headless, one-shot
        "--json",
        "--dangerously-skip-permissions"  # skip all prompts
        # "--verbose"
    ]

    print(f"Running Claude with prompt: {prompt}")
    
    # Execute and capture stdout/stderr
    result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=os.environ.copy(),
    )

    # Check if the command failed
    if result.returncode != 0:
        print(f"Error running Claude CLI. Exit code: {result.returncode}")
        print(f"Command: {' '.join(cmd)}")
        print(f"Stderr:\n{result.stderr}")
        print(f"Stdout:\n{result.stdout}")
        return None  # Indicate failure

    return json.loads(result.stdout)['result']

def codebase_query(repo_name, repo_owner, card: str) -> dict | str | None:
    repo_url = f"https://github.com/{repo_owner}/{repo_name}.git" 
    dir_name = f"./{repo_name}" 

    if not download_repo(repo_url, dir_name):
        print("Failed to download repository. Exiting.")
        sys.exit(1) # Exit if download fails
        
    print(f"Running Codex:\n\n")
    start_time = time.time()
    response = run_codex(card, dir_name)
    print(f"card help: {response['card_help']}")
    print(f"Time estimates: {response['time_estimates']}")
    end_time = time.time()
    print(f"Time taken: {end_time - start_time} seconds")
    
    print(f"Cleaning up {dir_name}...")
    shutil.rmtree(dir_name)
    
    return response

if __name__ == "__main__":
    repo_name = "BoardApp"
    repo_owner = "AlanSeeSaw"
    # repo_name = "code_qa"
    # repo_owner = "jayden-hyman"
    
    card = f"""
    Title: Create "Project Settings" (eg. # of devs + dev status)
    Description: Dev status is part time vs full time (we could be as specific as number of hours a week).

we should make a "project settings" or something where we add this stuff. We will have more project settings down the line (in the backlog) but let's start with this.

This is used to feed into the board time estimate so the LLM knows how many people are working and what not.
    """
    
    codebase_query(repo_name, repo_owner, card)