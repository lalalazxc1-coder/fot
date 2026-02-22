from database.database import SessionLocal
from database.models import JobOffer

def fix_signatories():
    db = SessionLocal()
    try:
        offers = db.query(JobOffer).filter(JobOffer.signatories == None).all()
        print(f"Found {len(offers)} offers with NULL signatories.")
        for offer in offers:
            offer.signatories = []
        db.commit()
        print("Successfully updated all offers.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_signatories()
