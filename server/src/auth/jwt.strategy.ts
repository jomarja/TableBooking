import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_SECRET } from '../config/env';

export interface JwtPayload {
  sub: string;
  role: 'staff' | 'admin';
  restaurantId?: string;
  email: string;
  name: string;
  // Set only on impersonation tokens an admin mints via "Login as Restaurant".
  // The token otherwise behaves as a normal staff token; these claims let the
  // banner + audit log show that an admin is acting as the restaurant.
  impersonatedBy?: string; // admin display name
  impersonatorId?: string; // admin id
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload) {
    return payload;
  }
}
