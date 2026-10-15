import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { Resend } from 'resend';
import { sendContactEmail, type ResendLike } from './app/contact/send-contact-email';

const browserDistFolder = join(import.meta.dirname, '../browser');

// En desarrollo carga el `.env-template` de la raíz; en producción el host de
// deploy inyecta las variables de entorno (y el archivo puede no existir).
try {
  process.loadEnvFile?.('.env-template');
} catch {
  // Sin `.env-template`: las variables llegan del entorno del host.
}

// La API key vive solo en el servidor: si falta, el cliente no se construye y
// el endpoint responde 500 en lugar de intentar enviar sin credenciales.
const resendApiKey = process.env['API_KEY_RESEND'];
const resend: ResendLike | null = resendApiKey ? new Resend(resendApiKey) : null;
const contactTo = process.env['CONTACT_TO'] ?? 'capr.developer@gmail.com';

const app = express();
const angularApp = new AngularNodeAppEngine();

// Cuerpos JSON para los endpoints de API.
app.use(express.json());

/**
 * Endpoint de contacto: valida y envía el aviso al equipo vía Resend.
 * Debe quedar registrado ANTES del handler SSR catch-all de abajo.
 */
app.post('/api/contacto', async (req, res) => {
  const result = await sendContactEmail(req.body, { resend, to: contactTo });
  res.status(result.status).json(result.body);
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
