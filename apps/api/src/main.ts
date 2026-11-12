import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { configureApp } from './app.js';
import { AppModule } from './app.module.js';
import { CONFIG, type Config } from './common/index.js';

const app = await NestFactory.create(AppModule);
configureApp(app);
app.enableShutdownHooks();
await app.listen(app.get<Config>(CONFIG).port, '0.0.0.0');
