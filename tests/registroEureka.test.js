// Registro en Eureka: se prueba contra un Eureka falso (un servidor HTTP que anota lo que recibe).
const http = require("http");
const { registrarEnEureka } = require("../src/clients/registroEureka");

const APP = "carrito";

function eurekaFalso() {
  const pedidos = [];
  const estado = { latidoResponde: 200 };
  const servidor = http.createServer((req, res) => {
    let cuerpo = "";
    req.on("data", (parte) => (cuerpo += parte));
    req.on("end", () => {
      pedidos.push({ metodo: req.method, ruta: req.url, cuerpo: cuerpo ? JSON.parse(cuerpo) : null });
      const esLatido = req.method === "PUT" && !req.url.includes("/status");
      res.statusCode = esLatido ? estado.latidoResponde : req.method === "POST" ? 204 : 200;
      res.end();
    });
  });
  return new Promise((resolver) =>
    servidor.listen(0, () => resolver({ servidor, pedidos, estado, url: `http://localhost:${servidor.address().port}/eureka` }))
  );
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

describe("registro en Eureka", () => {
  let eureka;
  let registro;

  beforeEach(async () => {
    eureka = await eurekaFalso();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(async () => {
    if (registro) await registro.detener();
    registro = null;
    await new Promise((r) => eureka.servidor.close(r));
    jest.restoreAllMocks();
  });

  test("sin EUREKA_URL no hace nada", () => {
    expect(registrarEnEureka({ app: APP, puerto: 3000, url: "" })).toBeNull();
  });

  test("se registra con su nombre, IP y puerto, y después manda latidos", async () => {
    registro = registrarEnEureka({ app: APP, puerto: 3000, url: eureka.url, ip: "172.20.0.9", intervaloMs: 40 });
    await esperar(150);

    const [registroInicial] = eureka.pedidos;
    expect(registroInicial.metodo).toBe("POST");
    expect(registroInicial.ruta).toBe(`/eureka/apps/${APP.toUpperCase()}`);
    expect(registroInicial.cuerpo.instance).toMatchObject({
      app: APP.toUpperCase(),
      ipAddr: "172.20.0.9",
      port: { $: 3000, "@enabled": "true" },
      status: "UP",
    });
    const latidos = eureka.pedidos.filter((p) => p.metodo === "PUT" && !p.ruta.includes("/status"));
    expect(latidos.length).toBeGreaterThanOrEqual(2);
  });

  test("si Eureka ya no lo conoce (404), se vuelve a registrar", async () => {
    registro = registrarEnEureka({ app: APP, puerto: 3000, url: eureka.url, intervaloMs: 40 });
    await esperar(60);
    eureka.estado.latidoResponde = 404;
    await esperar(60);

    const registros = eureka.pedidos.filter((p) => p.metodo === "POST");
    expect(registros.length).toBeGreaterThanOrEqual(2);
  });

  test("publica DOWN cuando la salud falla y UP cuando vuelve", async () => {
    let sano = true;
    registro = registrarEnEureka({
      app: APP, puerto: 3000, url: eureka.url, intervaloMs: 40, comprobarSalud: async () => sano,
    });
    await esperar(60);
    sano = false;
    await esperar(80);
    sano = true;
    await esperar(80);

    const cambios = eureka.pedidos.filter((p) => p.ruta.includes("/status?value="));
    expect(cambios.map((p) => p.ruta.split("value=")[1])).toEqual(["DOWN", "UP"]);
  });

  test("si Eureka no responde, el servicio sigue y no lanza errores", async () => {
    registro = registrarEnEureka({ app: APP, puerto: 3000, url: "http://localhost:1/eureka", intervaloMs: 40 });
    await esperar(100);
    expect(registro).not.toBeNull();
  });

  test("al detenerse se despide de Eureka", async () => {
    registro = registrarEnEureka({ app: APP, puerto: 3000, url: eureka.url, intervaloMs: 1000 });
    await esperar(60);
    await registro.detener();
    registro = null;

    expect(eureka.pedidos.at(-1).metodo).toBe("DELETE");
  });
});
