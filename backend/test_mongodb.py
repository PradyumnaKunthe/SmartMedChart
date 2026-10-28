from app.mongo_client import (
    mongo_client,
    mongo_db,
    ping_mongodb,
)

try:
    ping_mongodb()

    print("MongoDB connection successful!")
    print("Database:", mongo_db.name)
    print("Collections:", mongo_db.list_collection_names())

except Exception as error:
    print("MongoDB connection failed:")
    print(error)
    raise

finally:
    mongo_client.close()