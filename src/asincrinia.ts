// Simula consulta de stock a otros servicios por la red

function consultarStock(sku: string, demoraMs: number): Promise<number> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(40), demoraMs);
    });
}

// Simula un fallo por tiempo de espera

function timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(`No respondió en ${ms} ms`));
        }, ms);
    });
}

// Programa principal

async function main(): Promise<void> {

    console.log("1.- Antes de consultar a los servicios");

    const stock = await consultarStock("Parlantes", 500);

    console.log("2.- Stock recibido:", stock);

    try {
        const lento = await Promise.race([
            consultarStock("Mouse", 3000),
            timeout(1000)
        ]);

        console.log("Stock del Mouse:", lento);

    } catch (error) {
        console.log("3.- Error:", (error as Error).message);
    }

    console.log("4.- El programa continúa después de las llamadas a los servicios");
}

main();