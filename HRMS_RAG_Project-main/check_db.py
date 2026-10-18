from qdrant_client import QdrantClient

# 1. Connect to your local Qdrant storage folder
client = QdrantClient(path="./qdrant_storage")

# Use your active collection name (e.g., "hrms_crm_data")
collection_name = "hrms_crm_data"

# 2. Check if the collection exists and count the vectors
try:
    info = client.get_collection(collection_name=collection_name)
    print(f"✅ Collection '{collection_name}' found!")
    print(f"📊 Total Document Chunks Stored: {info.points_count}")
except Exception as e:
    print(f"❌ Could not access collection '{collection_name}': {e}")
    client.close()
    exit()

# 3. Retrieve and inspect the first 3 document chunks
print("\n--- Inspecting Stored Document Payloads ---")
records, _ = client.scroll(
    collection_name=collection_name,
    limit=3,
    with_payload=True,
    with_vectors=False  # Set to True if you want to see the 384-dimension vector arrays
)

for idx, record in enumerate(records, 1):
    print(f"\n📄 Chunk #{idx} (ID: {record.id})")
    # Inspect custom metadata tags
    print(f"   Allowed Roles : {record.payload.get('allowed_roles', 'N/A')}")
    print(f"   File Hash     : {record.payload.get('file_hash', 'N/A')}")
    print(f"   Category      : {record.payload.get('category', 'N/A')}")
    
    # LlamaIndex typically stores the text under '_node_content' or a 'text' field
    payload_preview = str(record.payload)[:180]
    print(f"   Text/Payload  : {payload_preview}...")

# 4. Clean shutdown to avoid Windows file-lock errors
client.close()