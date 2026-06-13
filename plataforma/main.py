import os
import shutil
import signal
import subprocess
import sys
import threading
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"


def backend_python():
    venv_python = BACKEND_DIR / ".venv312" / "Scripts" / "python.exe"
    if venv_python.exists():
        return str(venv_python)
    return sys.executable


def npm_command():
    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm:
        raise RuntimeError("npm nao encontrado no PATH.")
    return npm


def stream_output(name, process):
    assert process.stdout is not None
    for line in process.stdout:
        print(f"[{name}] {line}", end="")


def start_process(name, command, cwd):
    process = subprocess.Popen(
        command,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    thread = threading.Thread(target=stream_output, args=(name, process), daemon=True)
    thread.start()
    return process


def stop_process(process):
    if process.poll() is not None:
        return

    if os.name == "nt":
        process.terminate()
    else:
        process.send_signal(signal.SIGTERM)


def main():
    backend_cmd = [
        backend_python(),
        "-m",
        "uvicorn",
        "main:app",
        "--reload",
        "--port",
        "8000",
    ]
    frontend_cmd = [npm_command(), "run", "dev", "--", "--host", "127.0.0.1"]

    print("Iniciando plataforma...")
    print("App:  http://127.0.0.1:5173/")
    print("API:  http://127.0.0.1:8000/")
    print("Docs: http://127.0.0.1:8000/docs")
    print("Pressione Ctrl+C para encerrar.\n")

    processes = [
        start_process("backend", backend_cmd, BACKEND_DIR),
        start_process("frontend", frontend_cmd, FRONTEND_DIR),
    ]

    try:
        while True:
            for process in processes:
                exit_code = process.poll()
                if exit_code is not None:
                    raise RuntimeError(f"Um processo encerrou com codigo {exit_code}.")
            threading.Event().wait(1)
    except KeyboardInterrupt:
        print("\nEncerrando plataforma...")
    finally:
        for process in processes:
            stop_process(process)


if __name__ == "__main__":
    main()
