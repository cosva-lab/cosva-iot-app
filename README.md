# COSVA IoT Smart Farm System

A complete IoT system for smart dairy farms, built as a Node.js microservices architecture and deployed with containers.

## Local development

This repo runs the farm stack (Docker, `config.yml`, `.env`). It consumes published packages (`@cosva-lab/*`) from GitHub Packages by default.

```bash
npm run install:all
npm run docker:up
npm run db:migrate
```

For live local development alongside the **cosva-iot** monorepo:
```bash
npm run dev:watch                  # Live reload with bind-mounts from sibling cosva-iot
npm run dev:reload:dashboard       # Rebuild cosva-iot dashboard and recreate container
npm run dev:reload:services        # Rebuild cosva-iot services, migrate and recreate
```

Dirty edge Postgres during development: `npm run dev:reset-db` (prefer wipe+resync over migration shims — pre-production).

**Sensor simulator** (host MQTT, same topics as the firmware). Install once, then drive scales, RFID, and a queue of animals:

```bash
cd cli && npm install
npm run sim
npm run sim -- weight --stall 1 --kg 4.2
npm run sim -- milk --queue 1:COSV_ID:1.3,1:COSV_ID:0.670
```

Bring equipment online, open the parlor on the dashboard, then scan and milk. `--animal` is the Cosva id.

**Product specs / agent context** live in the sibling repo: [`cosva-iot/docs/sdd/`](../cosva-iot/docs/sdd/README.md) — especially [`08-agent-context.md`](../cosva-iot/docs/sdd/08-agent-context.md) (identity, offline milk sync, farmDate, sync UX, code paths).


## 🚀 Main features

- **Microservices architecture**: Modular services for sensors, sync, and the dashboard
- **MQTT communication**: Mosquitto broker for real-time messaging
- **Relational database**: PostgreSQL with Prisma ORM
- **Redis cache**: Session handling and performance
- **Nginx proxy**: Load balancer and reverse proxy
- **Containers**: Docker and Docker Compose for deployment
- **Monorepo**: Centralized management with Turbo and npm workspaces

## 📋 System requirements

- **Node.js**: >= 18.0.0
- **Docker**: >= 20.10
- **Docker Compose**: >= 2.0
- **npm**: >= 10.9.2

## 🏗️ System architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Sensor Service │    │   Sync Service  │    │Dashboard Service│
│                 │    │                 │    │                 │
│ RFID Sensors    │    │ API Integration │    │ Web Interface   │
│ Presence Detection│  │ Data Sync       │    │ Real-time Data  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  MQTT Broker    │
                    │  (Mosquitto)    │
                    └─────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │   PostgreSQL    │ │     Redis       │ │     Nginx       │
    │   Database      │ │     Cache       │ │ Reverse Proxy   │
    └─────────────────┘ └─────────────────┘ └─────────────────┘
```

## 🚀 Quick start

### 1. Clone the repository

```bash
git clone https://github.com/cosva-lab/cosva-iot-app.git
cd cosva-iot-app
```

### 2. Configure the files

#### Environment variables
```bash
cp env.example .env
```

#### Farm and sensor configuration
```bash
cp config.example.yml config.yml
```

**Edit `.env`** with your settings:

```env
# Database
DB_NAME=cosva_iot
DB_USERNAME=cosva_user
DB_PASSWORD=cosva_password
DB_PORT=5433

# MQTT
MQTT_USERNAME=cosva_service
MQTT_PASSWORD=cosva123
MQTT_PORT=1883
MQTT_WS_PORT=9002

# Redis
REDIS_PASSWORD=cosva_redis_password
REDIS_PORT=6381

# External API
API_BASE_URL=https://api.cosva.com
API_KEY=your-api-key-here

# Services
DASHBOARD_SERVICE_PORT=3000
NODE_ENV=production
```

**Customize `config.yml`** for your farm:

- **Farm id and name**: Update `farm.id` and `farm.name`
- **Stalls**: Set the number of stalls you need
- **Sensors**: Define the RFID sensors (serial or WiFi) for each stall
- **Serial ports**: Adjust `/dev/ttyUSB*` to match your hardware
- **WiFi IPs**: Set the IP addresses of wireless sensors
- **Goats or cows**: same keys, different kilograms. `config.example.yml` has both profiles under `milking`. Set `animal_kind` (`CAPRINE` or `BOVINE`) and measure `machine_weight_kg` on each scale stall: weight with the cluster on the animal, minus the weight once it is hung again. On the goat stall that was 1.00 kg → 0.94 kg, so `0.060`. A cow cluster is heavier; do not reuse `0.060`. `container_drop_kg` has to be a real can swap, larger than that cluster.

### 3. Configure access to private packages

This project uses private Cosva Lab packages hosted on GitHub Packages. Configure access:

```bash
cp .npmrc.example .npmrc
```

Edit `.npmrc` and replace the example token with your personal GitHub token:

```bash
registry=https://registry.npmjs.org

# Cosva Lab organization
@cosva-lab:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN_HERE
```

#### Create a GitHub token

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate a new token with the `read:packages` scope
3. Copy the token and paste it into `.npmrc`

**⚠️ Important**:
- Do not share your GitHub token
- `.npmrc` is in `.gitignore` so it is not committed by accident
- Each developer configures their own token

### 4. Install dependencies

```bash
npm run install:all
```

### 5. Generate the Prisma client

```bash
npm run db:generate
```

## 🐳 Docker deployment

### Development mode (infrastructure only)

For local development, start only the infrastructure (database, MQTT, Redis, Nginx):

```bash
npm run docker:up
```

Application services run locally:

```bash
npm start
```

### Production mode (full system)

To deploy the full system in production:

```bash
npm run docker:prod
```

To stop it:

```bash
npm run docker:prod:down
```

## 🔧 Available scripts

### Development
- `npm run dev:watch` — Live reload with local packages from `cosva-iot`
- `npm run dev:reload:dashboard` — Rebuild cosva-iot dashboard and recreate container
- `npm run dev:reload:services` — Rebuild cosva-iot packages, run migrations, and recreate app services
- `npm start` — Run app services locally (without Docker app containers)
- `npm run docker:up` / `dev:up` — Start Docker stack
- `npm run docker:down` — Stop stack
- `npm run dev:logs` / `dev:ps` — Logs and container status


### Production
- `npm run docker:prod` - Deploy the full system
- `npm run docker:prod:down` - Stop the full system

### Database
- `npm run db:generate` - Generate the Prisma client
- `npm run db:migrate` - Run migrations
- `npm run db:seed` - Seed test data

### Utilities
- `npm run build:shared` - Build the shared base image
- `npm run docker:clean` - Remove containers and volumes
- `npm run clean` - Remove node_modules
- `npm run install:all` - Install all dependencies

## 📊 Services

### 🔬 Sensor Service
- **Port**: Variable (internal)
- **Role**: RFID sensors and presence detection
- **Stack**: Node.js, serial communication
- **Package**: `@cosva-lab/iot-sensor`

### 🔄 Sync Service
- **Port**: Variable (internal)
- **Role**: Sync data with the external COSVA API
- **Stack**: Node.js, HTTP API integration
- **Retries**: 3 automatic attempts

### 📈 Dashboard Service
- **Port**: 3000 (configurable)
- **Role**: Web interface for monitoring and control
- **Stack**: Node.js, web interface
- **Package**: `@cosva-lab/iot-dashboard`

## 🗄️ Infrastructure

### 🐘 PostgreSQL
- **Port**: 5433 (external) / 5432 (internal)
- **Database**: cosva_iot
- **Health check**: Enabled
- **Persistence**: Docker volume

### 🦟 Mosquitto MQTT
- **MQTT port**: 1883 (external and internal)
- **WebSocket port**: 9002 (external) / 9001 (internal)
- **Authentication**: Configurable username and password
- **Persistence**: Volumes for config, data, and logs

### 🟥 Redis
- **Port**: 6381 (external) / 6379 (internal)
- **Role**: Cache and session handling
- **Persistence**: AOF enabled

### 🌐 Nginx
- **HTTP port**: 80
- **HTTPS port**: 443
- **Role**: Reverse proxy and load balancer
- **SSL**: Support for custom certificates

## ⚙️ Configuration

### config.yml
`config.yml` holds the static farm and sensor configuration:

```yaml
farm:
  id: 'farm-001'
  name: 'Main Dairy Farm'

# Stall configuration
stalls:
  - id: 'stall-001'
    number: 1
    sensor_id: 'RFID01'
    status: 'available'
  - id: 'stall-002'
    number: 2
    sensor_id: 'RFID02'
    status: 'available'
  # ... up to 6 stalls

# Sensor configuration
sensors:
  - sensor_id: 'RFID01'
    stall_number: 1
    protocol: 'serial'        # serial or wifi
    port: '/dev/ttyUSB0'      # for serial
    baud_rate: 9600
    timeout: 2
    
  - sensor_id: 'RFID03'
    stall_number: 3
    protocol: 'wifi'          # WiFi sensor
    ip: '192.168.1.102'       # sensor IP
    port_number: 8080
    timeout: 2
```

#### Supported sensor types

**Serial sensors (USB/RS485):**
- Port: `/dev/ttyUSB0`, `/dev/ttyUSB1`, and so on
- Baud rate: 9600 (configurable)
- Timeout: 2 seconds

**WiFi/Ethernet sensors:**
- IP: Sensor IP address
- Port: Communication port (typically 8080)
- Timeout: 2 seconds

### Environment variables
Dynamic settings are managed through environment variables:

- **BASE_URL**: API base URL
- **DATABASE_URL**: PostgreSQL connection string
- **MQTT_***: MQTT broker settings
- **LOG_LEVEL**: Logging level (DEBUG, INFO, WARN, ERROR)

## 🔍 Monitoring and logs

### Health checks
- PostgreSQL has an automatic health check
- Services are configured with restart: unless-stopped

### Logs
Logs are stored in:
- Mosquitto: `./broker/mosquitto/log/`
- Docker containers: `docker logs <container-name>`

### Useful commands

```bash
# Logs for every service
docker compose logs -f

# Logs for one service
docker compose logs -f sensor-service

# Container status
docker compose ps

# Restart a service
docker compose restart sensor-service
```

## 🛠️ Development

### Project structure

```
cosva-iot-app/
├── services/                 # Microservices
│   ├── sensor/              # Sensor service
│   ├── sync/                # Sync service
│   └── dashboard/           # Dashboard service
├── broker/                  # Broker configuration
│   ├── mosquitto/          # MQTT broker config
│   └── nginx/              # Nginx config
├── scripts/                # Utility scripts
├── config.yml             # Farm configuration
├── docker compose.yml     # Docker orchestration
└── package.json           # Root configuration
```

### Cosva Lab packages

The project uses these private organization packages:

- **@cosva-lab/iot-sensor** (v1.0.1): RFID sensors and presence detection
- **@cosva-lab/iot-dashboard** (v1.0.0): Web interface and dashboard components
- **@cosva-lab/iot-db** (v1.0.1): Database models and schemas
- **@cosva-lab/iot-shared** (v1.0.3): Shared utilities and types

These packages are hosted on GitHub Packages and require authentication (see the `.npmrc` setup).

### Sensor configuration

#### Add new sensors

1. **Add the stall** in the `stalls` section of `config.yml`:
```yaml
stalls:
  - id: 'stall-007'
    number: 7
    sensor_id: 'RFID07'
    status: 'available'
```

2. **Configure the sensor** in the `sensors` section:

**Serial sensor:**
```yaml
sensors:
  - sensor_id: 'RFID07'
    stall_number: 7
    protocol: 'serial'
    port: '/dev/ttyUSB4'
    baud_rate: 9600
    timeout: 2
```

**WiFi sensor:**
```yaml
sensors:
  - sensor_id: 'RFID07'
    stall_number: 7
    protocol: 'wifi'
    ip: '192.168.1.107'
    port_number: 8080
    timeout: 2
```

3. **Restart the sensor service**:
```bash
docker compose restart sensor-service
```

#### Serial port access in Docker

For serial sensors, give the container access to the USB devices:

```yaml
# In docker compose.yml
sensor-service:
  devices:
    - /dev/ttyUSB0:/dev/ttyUSB0
    - /dev/ttyUSB1:/dev/ttyUSB1
    # Add more as needed
```

### Local development

For development, you can run services individually:

```bash
# Infrastructure only
npm run docker:up

# In separate terminals
cd services/sensor && npm start
cd services/sync && npm start  
cd services/dashboard && npm start
```

## 🔒 Security

- **MQTT authentication**: Username and password required
- **Isolated network**: All services on a private Docker network
- **SSL configuration**: Nginx configured for HTTPS
- **Environment variables**: Secrets managed through `.env`

## 🚨 Troubleshooting

### Database does not connect
```bash
# Check PostgreSQL status
docker compose logs postgres

# Restart the database
docker compose restart postgres
```

### MQTT broker does not respond
```bash
# Check Mosquitto configuration
docker compose logs mosquitto

# Check ports
netstat -an | grep 1883
```

### A service does not start
```bash
# Check the service logs
docker compose logs <service-name>

# Check environment variables
docker compose config
```

### Reset the full system
```bash
npm run docker:clean
npm run clean
npm run install:all
```

## Raspberry Pi and MQTT 1883

ESP32 devices publish to `cosva-pi.local:1883`. Compose exposes that host port. If Raspberry Pi OS already runs Mosquitto through systemd, Docker fails with `bind: address already in use`. Before `docker compose up`:

```bash
sudo systemctl disable --now mosquitto
```

## Farm API key

`API_KEY` is a Cosva farm API key. It starts with `csk_` and is sent as `Authorization: Bearer`. It is not a user session JWT.

A farm **Owner**, or a platform **Admin** who is not a member of the farm, creates it with their own user JWT against `POST {API_BASE_URL}/graphql`. The full secret is returned only once. Copy it into `.env` and do not commit it.

```graphql
mutation CreateFarmApiKey($farmId: ID!, $input: CreateFarmApiKeyInput!) {
  createFarmApiKey(farmId: $farmId, input: $input) {
    secret
    apiKey {
      id
      name
      keyPrefix
      scopes
    }
  }
}
```

```json
{
  "farmId": "<farm id>",
  "input": { "name": "Parlor Pi" }
}
```

Omit `scopes` to grant the parlor preset:

| Scope | What the parlor can do |
| --- | --- |
| `ANIMALS_READ` | Read animals (RFID, plaque, lactation, reproductive cycle, mastitis, treatments, group memberships) and animal groups |
| `MILKING_SLOTS_READ` | Read farm milking slots |
| `MILK_UOM_READ` | Read the farm milk unit (liters or kilograms, global or per species). Stored production stays in liters |
| `MILK_WRITE` | Create and edit milk production. Send `source` as `IOT` or `OPERATOR`. The same animal, slot, and day updates the existing row |

The key cannot delete milk or call the rest of the API. It keeps working until it is revoked or it expires, even if the person who created it is not a farm member.

```graphql
query FarmApiKeys($farmId: ID!) {
  farmApiKeys(farmId: $farmId) {
    id
    name
    keyPrefix
    scopes
    lastUsedAt
    revokedAt
  }
}

mutation RevokeFarmApiKey($id: ID!) {
  revokeFarmApiKey(id: $id) {
    id
    revokedAt
  }
}
```

Milking continues without a network. **Sync animals** is what downloads cows, goats, and the rest when the API is reachable.

Each stall in `config.yml` binds `rfid_id` (the firmware id, for example `reader-01`) and `scale_id` (`scale-01`).

## Iterate without publishing packages
 
Local loop (bind-mounts `cosva-iot` `dist/` directly into container `node_modules` and restarts Node on save):
 
```bash
npm run dev:watch
```
 
Parlor UI hot reload stays in `cosva-iot`: `npm run dev:ui` → http://localhost:3001.

In production and on other machines, `npm run docker:up` builds and runs directly with the published packages from GitHub Packages (`https://npm.pkg.github.com`).

## 📞 Support

For technical support:
- **Documentation**: This README
- **Issues**: Report them in the repository
- **Logs**: Include relevant logs in reports

## 📄 License

This project is proprietary to COSVA Lab.

---

**COSVA IoT Smart Farm System** - Advanced technology for the farms of the future 🐄🚀
