"""Servidor local del Bingo Virtual.
Sirve las paginas y guarda copias de seguridad de las cartulinas en la carpeta 'copias'."""
import http.server
import json
import os

PORT = 8123
BASE = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE)


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/api/backup':
            self.send_error(404)
            return
        size = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(size)
        try:
            data = json.loads(raw)
            rid = int(data.get('round', 1))
        except Exception:
            self.send_error(400)
            return
        os.makedirs(os.path.join(BASE, 'copias'), exist_ok=True)
        with open(os.path.join(BASE, 'copias', 'respaldo-ronda-%d.json' % rid), 'wb') as f:
            f.write(raw)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'ok')

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    http.server.ThreadingHTTPServer(('', PORT), Handler).serve_forever()
