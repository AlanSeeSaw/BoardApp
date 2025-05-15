# inputs: 
# - codebase context estimate
# - historical card data

# For historical card data, need to talk to team about methodology. I'm thinking RAG based on prob card title + descriptio.
#     do things like who is on the project and whatever matter or should we just embed the title + description and track the time per column?
# If we go with RAG, for optimization we store keys in list of already embedded cards and only embed new cards.


# outputs:
# - card estimate per column (need to decide on columns or how we can track that back to the board)
from openai import OpenAI
from dotenv import load_dotenv
from .system_prompts import PROMPT
import json

load_dotenv()


def call_llm(card, codebase_context, codebase_coding_estimate, codebase_qa_estimate, historical_card_data):
    client = OpenAI()
    # Format the system prompt with the provided inputs
    formatted_prompt = PROMPT.format(
        codebase_context=codebase_context,
        codebase_coding_estimate=codebase_coding_estimate,
        codebase_qa_estimate=codebase_qa_estimate,
        historical_card_data=historical_card_data
    )
    # Send to LLM
    response = client.chat.completions.create(
        model="gpt-4.1",
        instructions=formatted_prompt,
        input=f"Card Info: {card}"
    )
    content = response.output_text
    print(content)
    # Return parsed JSON as Python dict
    return json.loads(content)

def get_historical_card_data():
    """ Get historical card data from the database. Do RAG and shit. """
    
    # Get summary for this bug type
    
    # Call RAG function, depending on number of results also get random similar cards (same type)

def estimate_card(card, codebase_estimate):
    codebase_coding_estimate = codebase_estimate['time_estimates']['coding']
    codebase_qa_estimate = codebase_estimate['time_estimates']['qa_testing']
    codebase_context = codebase_estimate['card_help']
    
    # Get historical card data
    historical_card_data = get_historical_card_data()
    
    # Call the LLM and return its parsed response
    result = call_llm(
        card,
        codebase_context,
        codebase_coding_estimate,
        codebase_qa_estimate,
        historical_card_data
    )
    return result


def main():
    # Somehow get the inputs, firebase cloud func
    
    # maybe: use RAG to get historical card data
    
    estimate = estimate_card(card, codebase_estimate, historical_card_data)

if __name__ == "__main__":
    main()
