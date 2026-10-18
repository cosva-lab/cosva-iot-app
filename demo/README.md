# Demos Cosva IoT

## Ordeño interactivo (MQTT)

Simula RFID + báscula como el firmware, paso a paso o en automático.

```bash
cd cosva-iot-app
# Stack arriba (mosquitto en :1884, dashboard :3500, sensor)
npm run demo:milking
```

El script te pide:

1. **Puesto** (1, 2, …)
2. **Animal** (búsqueda por nombre/placa/RFID, o RFID manual)
3. **Producción total** en litros o kg
4. **Peso de cantina vacía** (tare)
5. Puedes armar una **cola** de varios animales
6. Modo **automático** o **paso a paso** (Enter entre fases, ideal para narrar)
7. Velocidad 1× / 2× / 4×
8. Auto-Start por MQTT o que tú pulses **Iniciar** en la UI

### Antes de correr

1. `docker compose up -d` (o `npm run docker:up`)
2. Abre el parlor y **abre el turno** (Empezar a ordeñar)
3. Animales sincronizados en la finca de `config.yml` (`farm.id`)
4. Recomendado en `config.yml`:

```yaml
milking:
  data_source: simulated   # no sube a Cosva; Start sin exigir equipos reales
  demo_ui: true            # botón Demo en el header del parlor
```

Tras cambiar `config.yml`: `docker compose restart dashboard-service sensor-service sync-service`

Tras cambiar código del dashboard: `npm run dev:reload:dashboard`

### Botón Demo en la UI

Con `demo_ui: true`, el header muestra un botón **Demo** (amarillo). Abre un modal para armar una cola de animales; mientras corre puedes **Cancelar demo**.

La secuencia respeta las reglas del motor (ADR-005 + `noise_kg`):
1. Plataforma vacía → RFID → cantina vacía (DETECTED, sin leche)
2. **Start** congela la tare
3. Rampa de peso con pasos **> `noise_kg`** (si no, el motor ignora los kg)
4. **Finish** bloquea la producción antes de retirar la cantina

**Cola inteligente:** secuencial **por puesto**, en paralelo entre puestos.
Si asignas animales a P1 y P2, ambos ordeñan a la vez; el siguiente animal
de P1 espera a que termine el actual de P1 (no espera a P2).

### Topics que publica

| Topic | Uso |
|-------|-----|
| `cosva/rfid/<id>/status` | online/offline (retained) |
| `cosva/rfid/<id>/tag` | detección |
| `cosva/rfid/<id>/present` | presencia |
| `cosva/rfid/<id>/gone` | salida |
| `cosva/scale/<id>/status` | online/offline |
| `cosva/scale/<id>/link` | up/down |
| `cosva/scale/<id>/weight` | kg (igual que firmware) |
| `milking/cmd` | start / finish |
