from pathlib import Path
import os

from dotenv import load_dotenv


def load_project_env() -> Path | None:
    override_path = (os.environ.get("FOT_ENV_FILE") or "").strip()
    if override_path:
        candidate = Path(override_path).expanduser().resolve()
        if candidate.exists():
            load_dotenv(dotenv_path=candidate, override=False)
            return candidate

    backend_dir = Path(__file__).resolve().parents[1]
    parent_dir = backend_dir.parent
    if (parent_dir / "docker-compose.yml").exists() or (parent_dir / "frontend").exists():
        project_root = parent_dir
    else:
        project_root = backend_dir

    env_path = project_root / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=False)
        return env_path

    return None
