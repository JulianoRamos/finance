import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { configurarApp } from './app.js';
import { AppModule } from './app.module.js';
import { CONFIGURACAO, type Configuracao } from './comum/index.js';

const app = await NestFactory.create(AppModule);
configurarApp(app);
app.enableShutdownHooks();
await app.listen(app.get<Configuracao>(CONFIGURACAO).porta, '0.0.0.0');
