import os
from qdrant_client import QdrantClient
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, StorageContext, Settings
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.readers.file import PyMuPDFReader
from llama_index.core.node_parser import SentenceSplitter
from qdrant_client.models import Filter, FieldCondition, MatchValue

# --- 1. Global Settings & Embeddings ---
print("Loading embedding model...")

embed_model = HuggingFaceEmbedding(
    model_name="BAAI/bge-small-en-v1.5",
    embed_batch_size=32
)
Settings.embed_model = embed_model
Settings.llm = None

Settings.node_parser = SentenceSplitter(
    chunk_size=512,
    chunk_overlap=50
)

# --- 2. Qdrant Setup ---
print("Initializing Qdrant database...")
client = QdrantClient(path="./qdrant_storage")

COLLECTION_NAME = "hrms_crm_data"

vector_store = QdrantVectorStore(
    client=client,
    collection_name=COLLECTION_NAME
)

storage_context = StorageContext.from_defaults(vector_store=vector_store)

# --- 3. Version Helper Function ---
def get_next_version(client, collection_name, document_id):
    results = client.scroll(
        collection_name=collection_name,
        scroll_filter=Filter(
            must=[
                FieldCondition(
                    key="document_id",
                    match=MatchValue(value=document_id)
                )
            ]
        ),
        limit=1000
    )

    versions = []

    for point in results[0]:
        payload = point.payload
        if payload and "version" in payload:
            versions.append(payload["version"])

    if not versions:
        return 1
    
    return max(versions) + 1

# --- 4. Deactivate Old Versions ---
def deactivate_old_versions(client, collection_name, document_id):
    # Step 1: Find existing points with same document_id
    results = client.scroll(
        collection_name=collection_name,
        scroll_filter=Filter(
            must=[
                FieldCondition(
                    key="document_id",
                    match=MatchValue(value=document_id)
                )
            ]
        ),
        limit=1000
    )

    points = results[0]

    # If no previous versions exist → nothing to deactivate
    if not points:
        return

    # Step 2: Extract point IDs
    point_ids = [point.id for point in points]

    # Step 3: Update payload using IDs
    client.set_payload(
        collection_name=collection_name,
        payload={"status": "inactive"},
        points=point_ids
    )


# --- 5. Load Documents ---
print("Parsing PDF documents...")

pdf_parser = PyMuPDFReader()
file_extractor = {".pdf": pdf_parser}

reader = SimpleDirectoryReader(
    input_dir="./data",
    file_extractor=file_extractor,
    required_exts=[".pdf"],
    recursive=True
)

documents = reader.load_data()
print(f"Loaded {len(documents)} chunks.")

# --- 6. Inject Metadata ---
print("Applying metadata (document_id, version, status)...")

file_versions = {}

for doc in documents:
    file_path = doc.metadata.get("file_path", "")
    file_name = os.path.basename(file_path)

    document_id = file_name

    if document_id not in file_versions:
        version = get_next_version(client, COLLECTION_NAME, document_id)
        deactivate_old_versions(client, COLLECTION_NAME, document_id)
        file_versions[document_id] = version

    doc.metadata = {
        "document_id": document_id,
        "status": "active",
        "version": file_versions[document_id]
    }

# --- 7. Store in Qdrant ---
print("Embedding and saving to Qdrant...")

index = VectorStoreIndex.from_documents(
    documents,
    storage_context=storage_context
)

print("✅ Ingestion complete with versioning!")

# --- 8. Close Client ---
client.close()