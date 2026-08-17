#!/usr/bin/env python3
"""開発用の静的サーバー。Cache-Control: no-cache を付けて
モジュール更新時に新旧JSが混在しないようにする。
使い方: python3 serve.py [port]  (デフォルト 8000)
"""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f'http://127.0.0.1:{port}/')
    http.server.ThreadingHTTPServer(('127.0.0.1', port), NoCacheHandler).serve_forever()
