# inputs: 
# - codebase context estimate
# - historical card data

# For historical card data, need to talk to team about methodology. I'm thinking RAG based on prob card title + descriptio.
#     do things like who is on the project and whatever matter or should we just embed the title + description and track the time per column?
# If we go with RAG, for optimization we store keys in list of already embedded cards and only embed new cards.


# outputs:
# - card estimate per column (need to decide on columns or how we can track that back to the board)
import openai
import dotenv
from .system_prompts import PROMPT
import json
from historical_cards import get_historical_card_summary, fetch_similar_historical_cards, get_random_historical_card_by_type

dotenv.load_dotenv()

def call_llm(card, codebase_context, historical_card_data, historical_card_summary, columns):
    # Format the system prompt with the provided inputs
    formatted_prompt = PROMPT.format(
        codebase_context=codebase_context,
        historical_card_data=historical_card_data,
        historical_card_summary=historical_card_summary,
        board_columns=json.dumps(columns)
    )
    print(f"Formatted prompt: {formatted_prompt}")
    # Send to LLM
    response = openai.responses.create(
        model="gpt-4.1",
        instructions=formatted_prompt,
        input=f"Card Info: {card}"
    )
    content = response.output_text
    print(f"Response: {content}")
    # Return parsed JSON as Python dict
    return json.loads(content)

def prune_summary(summary, card):
    """ Prune the summary to only include relevant columns for the card's type, with durations converted to hours. """
    card_type = card.get("type")
    def ms_to_hours(ms):
        return ms / 3600000.0
    pruned = {
        # Average durations by type (in hours)
        f"averageDurationBy{card_type}": ms_to_hours(summary.get("averageDurationByType", {}).get(card_type, 0)),
        f"averageDurationBy{card_type}PerColumn": {
            col: ms_to_hours(ms) for col, ms in summary.get("averageDurationByTypePerColumn", {}).get(card_type, {}).items()
        },
        # Overall average per column (in hours)
        "averageDurationPerColumnForAllTypes": {
            col: ms_to_hours(ms) for col, ms in summary.get("averageDurationPerColumn", {}).items()
        },
        # Total durations by type (in hours)
        f"totalDurationBy{card_type}": ms_to_hours(summary.get("totalDurationByType", {}).get(card_type, 0)),
        f"totalDurationBy{card_type}PerColumn": {
            col: ms_to_hours(ms) for col, ms in summary.get("totalDurationByTypePerColumn", {}).get(card_type, {}).items()
        },
        # Card counts (unchanged)
        f"totalCardsBy{card_type}": summary.get("totalCardsByType", {}).get(card_type, 0),
        f"totalCardsBy{card_type}PerColumn": summary.get("totalCardsByTypePerColumn", {}).get(card_type, {}),
    }
    return pruned

def get_historical_card_data(user_id, board_id, card):
    """ Get historical card data from the database, prune summary, and normalize card durations to hours. """
    # Get summary
    summary = get_historical_card_summary(user_id, board_id) or {}
    print(f"Summary: {summary}")
    
    # Prune summary and convert durations to hours
    summary = prune_summary(summary, card)
    print(f"Summary after pruning: {summary}")
    
    # Call RAG function, depending on number of results also get random similar cards (same type)
    query_text = f"{card.get('title', '')}\n\n{card.get('description', '')}"
    similar_cards = fetch_similar_historical_cards(user_id, board_id, query_text)
    print(f"Similar cards: {similar_cards}")
    if len(similar_cards) < 10:
        # Randomly pull # of cards to get to 10 from the same bug type
        cards_to_pull = 10 - len(similar_cards)
        print(f"Cards to pull: {cards_to_pull}")
        similar_cards.extend(get_random_historical_card_by_type(user_id, board_id, card.get("type"), cards_to_pull))
        print(f"Similar cards after pulling random cards: {similar_cards}")
    return similar_cards, summary

def estimate_card(user_id, board_id, card, codebase_context, columns):
    print(f"Estimating card: {card}")
    print(f"Codebase context: {codebase_context}")
    print(f"User ID: {user_id}")
    print(f"Board ID: {board_id}")
    print(f"Columns for estimation: {columns}")
    
    # Get historical card data
    historical_card_data, historical_card_summary = get_historical_card_data(user_id, board_id, card)
    
    # Call the LLM and return its parsed response
    result = call_llm(
        card,
        codebase_context,
        historical_card_data,
        historical_card_summary,
        columns
    )
    return result
