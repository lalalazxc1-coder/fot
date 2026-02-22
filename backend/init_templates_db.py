from database.database import engine, Base
from database import models

def init_templates():
    print("Creating job_offer_templates table if it doesn't exist...")
    models.JobOfferTemplate.__table__.create(bind=engine, checkfirst=True)
    print("Done.")

if __name__ == "__main__":
    init_templates()
