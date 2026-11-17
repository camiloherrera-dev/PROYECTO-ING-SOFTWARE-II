// Registro en Eureka, el registro de servicios de la tienda (lo levanta el docker-compose de
// integración; consola en http://localhost:8761).
//
// Usa la API REST de Eureka directamente, sin librerías:
//   POST   /apps/{APP}                       se anuncia: nombre, IP y puerto
//   PUT    /apps/{APP}/{id}                  latido cada 10 s; si pasan 30 sin latido, Eureka lo saca
//   PUT    /apps/{APP}/{id}/status?value=…   UP o DOWN, según la salud del servicio
//   DELETE /apps/{APP}/{id}                  se despide al apagarse
//
// Si EUREKA_URL no está definida no hace nada: las pruebas y el desarrollo sin Docker no cambian.
// Si Eureka no responde, el servicio sigue funcionando y lo vuelve a intentar en el siguiente latido.

const os = require("os");

/** La IP de este contenedor en la red de Docker (la primera IPv4 que no es localhost). */
function ipPropia() {
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const red of interfaces || []) {
      if (red.family === "IPv4" && !red.internal) return red.address;
    }
  }
  return "127.0.0.1";
}

/** Lo que Eureka necesita saber de la instancia, en el formato que espera. */
function datosDeInstancia({ app, puerto, ip, rutaSalud }) {
  const base = `http://${ip}:${puerto}`;
  return {
    instance: {
      instanceId: `${os.hostname()}:${app.toLowerCase()}:${puerto}`,
      app: app.toUpperCase(),
      hostName: ip,
      ipAddr: ip,
      vipAddress: app.toLowerCase(),
      status: "UP",
      port: { $: puerto, "@enabled": "true" },
      securePort: { $: 443, "@enabled": "false" },
      homePageUrl: `${base}/`,
      statusPageUrl: `${base}${rutaSalud}`,
      healthCheckUrl: `${base}${rutaSalud}`,
      dataCenterInfo: {
        "@class": "com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo",
        name: "MyOwn",
      },
      leaseInfo: { renewalIntervalInSecs: 10, durationInSecs: 30 },
    },
  };
}

/**
 * Registra el servicio y lo mantiene registrado.
 *
 * @param {object} opciones
 * @param {string} opciones.app             nombre del servicio en Eureka (por ejemplo "busqueda")
 * @param {number} opciones.puerto          puerto en el que escucha dentro de Docker
 * @param {string} [opciones.rutaSalud]     ruta de salud que muestra la consola de Eureka
 * @param {() => Promise<boolean>} [opciones.comprobarSalud]  true = UP, false = DOWN
 * @returns {{ detener: () => Promise<void> } | null}  null si no hay EUREKA_URL
 */
function registrarEnEureka({
  app,
  puerto,
  rutaSalud = "/",
  comprobarSalud = async () => true,
  url = process.env.EUREKA_URL,
  intervaloMs = 10000,
  ip = ipPropia(),
} = {}) {
  if (!url) return null;

  const servidor = url.replace(/\/+$/, "");
  const datos = datosDeInstancia({ app, puerto: Number(puerto), ip, rutaSalud });
  const nombre = datos.instance.app;
  const id = encodeURIComponent(datos.instance.instanceId);
  const instancia = `${servidor}/apps/${nombre}/${id}`;

  let registrado = false;
  let estadoPublicado = "UP";
  let avisoDeFalla = false;

  async function registrar() {
    const respuesta = await fetch(`${servidor}/apps/${nombre}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    if (!respuesta.ok) throw new Error(`Eureka respondió ${respuesta.status} al registrar`);
    registrado = true;
    estadoPublicado = "UP";
    console.log(`[eureka] ${nombre} registrado en ${servidor} como ${datos.instance.instanceId}`);
  }

  async function latido() {
    try {
      if (!registrado) await registrar();

      const respuesta = await fetch(instancia, { method: "PUT" });
      // 404: Eureka no conoce esta instancia (se reinició, o la sacó por falta de latidos).
      if (respuesta.status === 404) await registrar();

      const sano = await comprobarSalud().catch(() => false);
      const estado = sano ? "UP" : "DOWN";
      if (estado !== estadoPublicado) {
        await fetch(`${instancia}/status?value=${estado}`, { method: "PUT" });
        estadoPublicado = estado;
        console.log(`[eureka] ${nombre} ahora está ${estado}`);
      }
      avisoDeFalla = false;
    } catch (error) {
      registrado = false;
      // Se avisa una sola vez, no en cada latido.
      if (!avisoDeFalla) console.warn(`[eureka] Sin conexión con Eureka (${error.message}); se reintenta`);
      avisoDeFalla = true;
    }
  }

  latido();
  const temporizador = setInterval(latido, intervaloMs);
  // El temporizador no mantiene vivo el proceso por sí solo.
  temporizador.unref();

  return {
    async detener() {
      clearInterval(temporizador);
      if (!registrado) return;
      await fetch(instancia, { method: "DELETE" }).catch(() => {});
      registrado = false;
    },
  };
}

module.exports = { registrarEnEureka, datosDeInstancia, ipPropia };
