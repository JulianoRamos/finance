import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { AuditModule } from '../audit/index.js';
import { EntitiesModule } from '../entities/index.js';
import { CreatorAccessInterceptor } from './creator-access.interceptor.js';
import { IdentityErrorFilter } from './identity-error.filter.js';
import { IdentityService } from './identity.service.js';
import { LoginAttemptsService } from './login-attempts.service.js';
import { PasswordChangeService } from './password-change.service.js';
import { PermissionsService } from './permissions.service.js';
import { RecoveryLinksController } from './recovery-links.controller.js';
import { RecoveryLinksService } from './recovery-links.service.js';
import { SessionGuard } from './session.guard.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuditModule, EntitiesModule],
  controllers: [SessionsController, RecoveryLinksController, UsersController],
  providers: [
    LoginAttemptsService,
    UsersService,
    SessionsService,
    RecoveryLinksService,
    PasswordChangeService,
    PermissionsService,
    IdentityService,
    // Toda rota é protegida pela sessão, salvo a marcada com @Public() (LLD, seção 5), e o guard confere
    // as marcas da permissão (regra 6.1).
    { provide: APP_GUARD, useClass: SessionGuard },
    // Quem cadastra uma entidade recebe operate nela, na rota marcada com @GrantsCreatorAccess().
    { provide: APP_INTERCEPTOR, useClass: CreatorAccessInterceptor },
    // A recusa da Identidade com código responde 422 nas rotas (LLD, seção 5).
    { provide: APP_FILTER, useClass: IdentityErrorFilter },
  ],
  exports: [IdentityService],
})
export class IdentityModule {}
