import openai
from dotenv import load_dotenv
from google.cloud import firestore
from google.cloud.firestore_v1.base_vector_query import DistanceMeasure
from google.cloud.firestore_v1.vector import Vector

load_dotenv()

client = openai.OpenAI()

def generate_embedding(data):
    """ Generate an embedding for a given text. """
    text = (
        f"Title: {data.get('title', '')} " \
        f"Description: {data.get('description', '')} " \
        f"Labels: {' '.join(data.get('labels', []))} " \
        f"Checklist: {' '.join(data.get('checklist', []))} " \
        f"Codebase Context: {data.get('codebaseContext', '')}"
    )
    print(f"Text to embed: {text}")
    # Call OpenAI for a 1536-dim embedding
    response = openai.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    vector = response.data[0].embedding
    print(f"Vector: {vector}")
    return vector

def fetch_similar_historical_cards(user_id: str, board_id: str, query_text: str) -> list:
    """
    Embed a query text and return up to `limit` similar historicalCards.
    """
    # Generate embedding for the query text
    response = openai.embeddings.create(
        model="text-embedding-3-small",
        input=query_text
    )
    query_vec = response.data[0].embedding

    # Firestore client and collection reference
    db = firestore.Client()
    coll_ref = (
        db.collection("users").document(user_id)
          .collection("boards").document(board_id)
          .collection("historicalCards")
    )

    # Perform KNN query
    vector_query = coll_ref.find_nearest(
        vector_field="embedding",
        query_vector=Vector(query_vec),
        distance_measure=DistanceMeasure.COSINE,
        limit=15
    )

    # Collect results
    results = []
    for doc in vector_query.stream():
        item = doc.to_dict()
        item["id"] = doc.id
        results.append(item)
    return results