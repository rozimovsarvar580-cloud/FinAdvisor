from finadvisor_api.database import SessionLocal
from finadvisor_api.personal_data import purge_expired_account_deletions


def main() -> None:
    with SessionLocal() as db:
        deleted_count = purge_expired_account_deletions(db)
    print(f"Purged expired account deletion requests: {deleted_count}")


if __name__ == "__main__":
    main()
