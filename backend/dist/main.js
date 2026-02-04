"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_1.ConfigService);
    const port = configService.get('PORT') ?? 3001;
    const corsOrigin = configService.get('CORS_ORIGIN') ?? 'http://localhost:3000';
    app.enableCors({
        origin: corsOrigin,
        credentials: true,
    });
    await app.listen(port);
    console.log(`NestJS backend running at http://localhost:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map