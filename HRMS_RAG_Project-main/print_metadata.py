import json
from qdrant_client import QdrantClient

# 1. Connect to your local Qdrant database folder
client = QdrantClient(path="./qdrant_storage")
collection_name = "hrms_crm_data"

try:
    info = client.get_collection(collection_name=collection_name)
    print(f"✅ Connected to '{collection_name}'. Total stored chunks: {info.points_count}\n")
except Exception as e:
    print(f"❌ Could not open collection '{collection_name}': {e}")
    client.close()
    exit()

# 2. Retrieve records with their payloads (metadata)
records, _ = client.scroll(
    collection_name=collection_name,
    limit=100,          # Adjust limit as needed
    with_payload=True,  # Crucial: fetches metadata
    with_vectors=False  # Skips printing 384-dim arrays
)

print("=" * 60)
print("              QDRANT STORED METADATA INSPECTION              ")
print("=" * 60)

for idx, record in enumerate(records, 1):
    payload = record.payload or {}
    
    # Extract common custom metadata fields
    allowed_roles = payload.get("allowed_roles") or payload.get("allowed_role", "N/A")
    file_hash = payload.get("file_hash", "N/A")
    category = payload.get("category", "N/A")
    status = payload.get("status", "active")
    file_name = payload.get("file_name") or payload.get("file_path", "N/A")
    
    print(f"\n📄 Chunk #{idx} | Vector ID: {record.id}")
    print("-" * 50)
    print(f"  • File Name     : {file_name}")
    print(f"  • Category      : {category}")
    print(f"  • Allowed Roles : {allowed_roles}")
    print(f"  • Status        : {status}")
    print(f"  • SHA-256 Hash  : {file_hash}")
    
    # Optional: Print all extra metadata keys (excluding large LlamaIndex text fields)
    other_keys = {
        k: v for k, v in payload.items() 
        if k not in ["_node_content", "text", "allowed_roles", "allowed_role", "file_hash", "category", "status", "file_name", "file_path"]
    }
    if other_keys:
        print(f"  • Other Metadata: {json.dumps(other_keys, indent=2)}")

# 3. Cleanly close database to prevent Windows file-lock errors
client.close()
print("\n✅ Metadata print complete. Database connection closed.")