import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuditModule } from '../audit/index.js';
import { IdentityService } from './identity.service.js';
import { LoginAttemptsService } from './login-attempts.service.js';
import { RecoveryLinksController } from './recovery-links.controller.js';
import { RecoveryLinksService } from './recovery-links.service.js';
import { SessionGuard } from './session.guard.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuditModule],
  controllers: [SessionsController, RecoveryLinksController],
  providers: [
    LoginAttemptsService,
    UsersService,
    SessionsService,
    RecoveryLinksService,
    IdentityService,
    // Toda rota é protegida pela sessão, salvo a marcada com @Public() (LLD, seção 5).
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [IdentityService],
})
export class IdentityModule {}
