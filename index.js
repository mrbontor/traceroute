const iniParser = require('./libs/iniParser')
const logging = require('./libs/logging')
const args = require('minimist')(process.argv.slice(2));
const WebSocket = require("ws");
const Traceroute = require("nodejs-traceroute");
const http = require("http");
const fs = require("fs");
const url = require('url');

process.env.TZ = 'Asia/Jakarta'
// default config if config file is not provided
let config = {
    log: {
        path: "var/log/",
        level: "debug"
    }
}

if (args.h || args.help) {
    // TODO: print USAGE
    console.log("Usage: node " + __filename + " --config");
    process.exit(-1);
}

// overwrite default config with config file
configFile = args.c || args.config || './configs/config.ini'
config = iniParser.init(config, configFile, args)
config.log.level = args.logLevel || config.log.level

const take_port = config.app.port;
const port = take_port || process.env.PORT;

// Initialize logging library
logging.init({
    path: config.log.path,
    level: config.log.level
})

logging.info(`[CONFIG] ${JSON.stringify(iniParser.get())}`)


const webServer = http.createServer((request, response) => {
    fs.readFile("./public/index.html", (err, data) => {
        response.writeHead(200, {
            "Content-Type": "text/html"
        });
        response.write(data);
        response.end();
    });
});

// const server = http.createServer();
const wss1 = new WebSocket.Server({
    // server: webServer,
    noServer: true
});
const wss2 = new WebSocket.Server({
    // server: webServer,
    noServer: true
});

wss1.on('connection', function connection(ws) {
    // ...
});

wss2.on('connection', function connection(ws) {
    // ...
});

let done = {status: false}

webServer.on('upgrade', function upgrade(request, socket, head) {
    const pathname = url.parse(request.url).pathname;

    if (pathname === '/traceroute') {
        wss1.handleUpgrade(request, socket, head, function done(ws) {
            wss1.emit('connection', ws, request);
            ws.on("message", hostname => {
                const tracer = new Traceroute();
                logging.info(`[StartTracing] ....`)
                tracer
                    .on("hop", (hop) => {
                        if (hop.ip == "*") {
                            return
                        }

                        let endpoint = config.api.url + hop.ip

                        http.get(endpoint, (response) => {
                                let loc = "";
                                response.on("data", data => {
                                    loc += data
                                });
                                response.on("end", () => ws.send(loc))
                            })
                            .on("error", err => {
                                logging.error(`[error] >>>> ${JSON.stringify(err)}`)
                            });
                    })
                    .on("close", (code) => {
                        ws.send(JSON.stringify(done))
                    });

                tracer.trace(hostname.toString());
            })
        });
    } else if (pathname === '/logger') {
        wss2.handleUpgrade(request, socket, head, function done(ws) {
            wss2.emit('connection', ws, request);
            ws.on("message", hostname => {
                const tracer = new Traceroute();
                tracer
                    .on("hop", (hop) => {
                        ws.send(JSON.stringify(hop))
                    })
                    .on("close", (code) => {
                        ws.send(JSON.stringify(done))
                    });
                tracer.trace(hostname.toString());
            })
        });
    } else {
        socket.destroy();
    }
});

webServer.listen(port);
logging.info('[app] TRACE ROUTE STARTED on ' + port);
