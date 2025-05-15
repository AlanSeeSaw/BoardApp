import openai
from dotenv import load_dotenv
from google.cloud import firestore
from google.cloud.firestore_v1.base_vector_query import DistanceMeasure
from google.cloud.firestore_v1.vector import Vector

load_dotenv()

client = openai.OpenAI()

def generate_embedding(data):
    """ Generate an embedding for a given text. """
    parts = []
    parts.append(data["title"])
    parts.append(data["description"])
    if data.get("labels", []):
        parts.append("Labels: " + ", ".join(data.get("labels", [])))
    if data.get("checklist", []):
        parts.append("Tasks: " + " | ".join([t for t in data.get("checklist", []) if len(t) > 5]))

    text = "\n".join(parts)
    print(f"Text to embed: {text}")
    # Call OpenAI for a 1536-dim embedding
    response = openai.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    vector = response.data[0].embedding
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

def update_historical_card_summary(doc_ref, data):
    """
    Update the Firestore summary doc under:
      /users/{userId}/boards/{boardId}/historicalStats/summary

    Fields in this summary:
      totalCards                       # total number of archived cards
      totalCardsByType                 # { issueType: count }
      totalDurationByType              # { issueType: ms }
      totalDurationByTypePerColumn     # { issueType: { columnId: ms }}
      totalCardsByTypePerColumn        # { issueType: { columnId: count }}
      averageDurationByType            # { issueType: avgMs }
      averageDurationByTypePerColumn   # { issueType: { columnId: avgMs }}

    Example:
      On first 'bug' card lasting 1200ms in 'colA':
        totalCards = 1
        totalCardsByType = {'bug':1}
        totalDurationByType = {'bug':1200}
        totalDurationByTypePerColumn = {'bug':{'colA':1200}}
        totalCardsByTypePerColumn = {'bug':{'colA':1}}
        averageDurationByType = {'bug':1200.0}
        averageDurationByTypePerColumn = {'bug':{'colA':1200.0}}

    Note: dict.setdefault(key, default) returns existing dict[key] or sets it to default first, simplifying nested map init.
    """
    db = firestore.Client()
    # Reference the single summary document under 'historicalStats'
    summary_ref = (
        doc_ref.parent.parent
               .collection("historicalStats")
               .document("summary")
    )

    # Precompute this card's total time and extract its per-column entries
    total_duration_ms = sum(e.get("totalDurationMs", 0)
                         for e in data.get("aggregatedTimeInColumns", []))
    time_entries = data.get("aggregatedTimeInColumns", [])  # list of {columnId, totalDurationMs}
    card_type = data.get("type", "unknown")               # e.g. 'bug', 'feature'

    transaction = db.transaction()

    @firestore.transactional
    def update_summary_tx(tx):
        # 1) Load current summary snapshot (or start fresh)
        snap = summary_ref.get(transaction=tx)
        summary = snap.to_dict() or {}

        # 2) Global card count
        summary["totalCards"] = summary.get("totalCards", 0) + 1

        # 3) Per-type aggregates
        total_cards_by_type_map    = summary.setdefault("totalCardsByType", {})    # {type: count}
        total_duration_by_type_map = summary.setdefault("totalDurationByType", {})   # {type: ms}
        total_cards_by_type_map[card_type]    = total_cards_by_type_map.get(card_type, 0)    + 1
        total_duration_by_type_map[card_type] = total_duration_by_type_map.get(card_type, 0) + total_duration_ms

        # 4) Per-type-per-column breakdown
        duration_per_column_map = summary.setdefault("totalDurationByTypePerColumn", {})   # {type: {columnId: ms}}
        count_per_column_map    = summary.setdefault("totalCardsByTypePerColumn", {})      # {type: {columnId: count}}
        column_duration_map = duration_per_column_map.setdefault(card_type, {})  # nested for this type
        column_count_map    = count_per_column_map.setdefault(card_type, {})     # nested for this type
        for entry in time_entries:
            col_id = entry.get("columnId")
            dur_ms = entry.get("totalDurationMs", 0)
            # accumulate durations and counts per column
            column_duration_map[col_id] = column_duration_map.get(col_id, 0) + dur_ms
            column_count_map[col_id]    = column_count_map.get(col_id, 0)    + 1

        # 5) Averages per type
        average_by_type_map = summary.setdefault("averageDurationByType", {})            # {type: avgMs}
        average_by_type_map[card_type] = (
            total_duration_by_type_map[card_type] 
            / total_cards_by_type_map[card_type]
        )

        # 6) Averages per column per type
        average_per_column_map = summary.setdefault("averageDurationByTypePerColumn", {}) # {type: {columnId: avgMs}}
        avg_map = { col: column_duration_map[col] / column_count_map[col]
                    for col in column_duration_map }
        average_per_column_map[card_type] = avg_map

        # 7) Write merged summary back to Firestore
        tx.set(summary_ref, summary, merge=True)

    # Execute transactional update
    update_summary_tx(transaction)