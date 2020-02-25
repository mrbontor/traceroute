const iniParser = require('./libs/iniParser')
const logging = require('./libs/logging')
const args = require('minimist')(process.argv.slice(2));
const WebSocket = require("ws");
const Traceroute = require("nodejs-traceroute");
const http = require("http");
const fs = require("fs");

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

const server = new WebSocket.Server({
    server: webServer
});

server.on("connection", (ws) => {
    ws.on("message", (hostname) => {
        const tracer = new Traceroute();
        logging.info(`[StartTracing] ....`)
        tracer
        .on("hop", (hop) => {
            logging.info(`[trace][${hop.hop}] >>>> ${JSON.stringify(hop)}`)

            if (hop.ip == "*") { return }

            const endpoint = config.api.url + hop.ip
            let dataToTrace = [endpoint, hop.rtt1]

            http.get(dataToTrace[0], (response) => {
                let loc = "";
                response.on("data", data => {
                    loc += data
                });

                loc.speed = hop.rtt1
                response.on("end", () => ws.send(loc))
            }).on("error", (err) => {
                logging.error(`[error] >>>> ${JSON.stringify(err)}`)
            });
        })
        .on("close", (code) => {
            const done = {status: "trace complete"}
            logging.info(`[trace] >>>> Complete`)
            ws.send(JSON.stringify(done))
        });

        tracer.trace(hostname.toString());
    });
});

webServer.listen(port);
logging.info('[app] TRACE ROUTE STARTED on ' + port);

function log(socket, data){
     console.log(data);
     socket.emit('message',data);
}
