import http.server, os
os.chdir('/Users/greest/Downloads/nit2-v3')
http.server.test(http.server.SimpleHTTPRequestHandler, port=8765, bind='127.0.0.1')
