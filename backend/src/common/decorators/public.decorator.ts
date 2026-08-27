import { SetMetadata } from '@nestjs/common';

/** JwtAuthGuard가 인증을 요구하지 않도록 표시하는 메타데이터 키. */
export const IS_PUBLIC_KEY = 'isPublic';

/** register/login/refresh처럼 토큰 없이 호출돼야 하는 핸들러에 붙인다. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
