import os

# Must run before app.store is imported: tests use a throwaway in-memory database.
os.environ["CAMPAIGN_DB"] = ":memory:"
os.environ["GEMINI_API_KEY"] = "test-key"
