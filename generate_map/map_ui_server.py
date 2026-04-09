from __future__ import annotations

import json
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import generate_map


ROOT = Path(__file__).resolve().parent


class MapUIHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _write_json(self, payload: dict, status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/spec":
            self._write_json(generate_map.parameter_schema())
            return
        if parsed.path == "/":
            self.path = "/index.html"
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/api/generate":
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw or b"{}")
            params = payload.get("params") or {}
            seed = payload.get("seed")
            map_data = generate_map.generate_map(config_overrides=params, seed=seed)
        except Exception as exc:
            self._write_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return

        self._write_json(map_data)


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 8010), MapUIHandler)
    print("Serving map UI on http://127.0.0.1:8010")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down map UI server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
