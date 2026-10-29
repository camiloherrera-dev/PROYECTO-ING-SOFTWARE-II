const AppError = require('../src/errors/AppError');

describe('HU-09 disponibilidad', () => {
  let availabilityService;
  let repository;
  let catalog;

  beforeEach(() => {
    jest.resetModules();

    repository = {
      getAllItems: jest.fn(),
      saveItem: jest.fn(),
    };

    catalog = {
      getProduct: jest.fn(),
    };

    const { createAvailabilityService } = require('../src/services/availabilityService');
    availabilityService = createAvailabilityService({ repository, catalog });
  });

  test('carrito vacío lanza CARRITO_VACIO (400)', async () => {
    repository.getAllItems.mockResolvedValue([]);

    await expect(availabilityService.checkAvailability('usr_1')).rejects.toMatchObject({
      status: 400,
      codigo: 'CARRITO_VACIO',
    });
  });

  test('todos los items en OK -> disponible true', async () => {
    repository.getAllItems.mockResolvedValue([
      { productId: 'prod_001', nombre: 'Prod1', precioUnitario: 10000, cantidad: 2 },
    ]);
    catalog.getProduct.mockResolvedValue({ productId: 'prod_001', nombre: 'Prod1', precio: 10000, activo: true, stock: 10 });

    const res = await availabilityService.checkAvailability('usr_1');
    expect(res.disponible).toBe(true);
    expect(res.items[0].estado).toBe('OK');
    expect(res.items[0].stock).toBe(10);
  });

  test('producto inactivo o no existe -> INACTIVO y disponible false', async () => {
    repository.getAllItems.mockResolvedValue([
      { productId: 'prod_002', nombre: 'Prod2', precioUnitario: 5000, cantidad: 1 },
    ]);
    catalog.getProduct.mockResolvedValue(null);

    const res = await availabilityService.checkAvailability('usr_1');
    expect(res.disponible).toBe(false);
    expect(res.items[0].estado).toBe('INACTIVO');
  });

  test('stock menor a cantidad -> SIN_STOCK y disponible false', async () => {
    repository.getAllItems.mockResolvedValue([
      { productId: 'prod_003', nombre: 'Prod3', precioUnitario: 3000, cantidad: 5 },
    ]);
    catalog.getProduct.mockResolvedValue({ productId: 'prod_003', nombre: 'Prod3', precio: 3000, activo: true, stock: 2 });

    const res = await availabilityService.checkAvailability('usr_1');
    expect(res.disponible).toBe(false);
    expect(res.items[0].estado).toBe('SIN_STOCK');
    expect(res.items[0].stock).toBe(2);
  });

  test('cambio de precio -> actualiza en Redis, añade precioAnterior, puede ser PRECIO_CAMBIO', async () => {
    repository.getAllItems.mockResolvedValue([
      { productId: 'prod_004', nombre: 'Prod4', precioUnitario: 10000, cantidad: 1 },
    ]);
    catalog.getProduct.mockResolvedValue({ productId: 'prod_004', nombre: 'Prod4', precio: 12000, activo: true, stock: 5 });

    const res = await availabilityService.checkAvailability('usr_1');
    expect(repository.saveItem).toHaveBeenCalledWith('usr_1', expect.objectContaining({
      productId: 'prod_004',
      precioUnitario: 12000,
      cantidad: 1,
    }));
    expect(res.items[0].estado).toBe('PRECIO_CAMBIO');
    expect(res.items[0].precioAnterior).toBe(10000);
    expect(res.disponible).toBe(false);
  });

  test('cambio de precio con stock insuficiente -> SIN_STOCK con precioAnterior', async () => {
    repository.getAllItems.mockResolvedValue([
      { productId: 'prod_005', nombre: 'Prod5', precioUnitario: 10000, cantidad: 10 },
    ]);
    catalog.getProduct.mockResolvedValue({ productId: 'prod_005', nombre: 'Prod5', precio: 11000, activo: true, stock: 3 });

    const res = await availabilityService.checkAvailability('usr_1');
    expect(repository.saveItem).toHaveBeenCalled();
    expect(res.items[0].estado).toBe('SIN_STOCK');
    expect(res.items[0].precioAnterior).toBe(10000);
    expect(res.disponible).toBe(false);
  });

  test('stock null pasa -> estado OK si precio igual y activo', async () => {
    repository.getAllItems.mockResolvedValue([
      { productId: 'prod_006', nombre: 'Prod6', precioUnitario: 8000, cantidad: 3 },
    ]);
    catalog.getProduct.mockResolvedValue({ productId: 'prod_006', nombre: 'Prod6', precio: 8000, activo: true, stock: null });

    const res = await availabilityService.checkAvailability('usr_1');
    expect(res.disponible).toBe(true);
    expect(res.items[0].estado).toBe('OK');
    expect(res.items[0].stock).toBe(null);
  });

  test('catálogo falla (503) se propaga', async () => {
    repository.getAllItems.mockResolvedValue([
      { productId: 'prod_007', nombre: 'Prod7', precioUnitario: 9000, cantidad: 1 },
    ]);
    const err = new AppError(503, 'CATALOGO_NO_DISPONIBLE', 'No fue posible consultar el servicio de Catálogo');
    catalog.getProduct.mockRejectedValue(err);

    await expect(availabilityService.checkAvailability('usr_1')).rejects.toMatchObject({
      status: 503,
      codigo: 'CATALOGO_NO_DISPONIBLE',
    });
  });
});
