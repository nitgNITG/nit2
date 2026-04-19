import jwt, { JwtPayload } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

export const authPredict = (req: NextRequest) => {
    try {
        let token = ""
        if (req) {
            const tokenBearar = req.headers.get('authorization') as string;
            if (tokenBearar) {
                token = tokenBearar?.split(" ")[1]
            } else {
                token = cookies().get('token')?.value as string;
            }
        }
        const decode = jwt.verify(token as string, process.env.SECRET_JWT as string) as JwtPayload;
        const id = decode.id;
        if (id)
            return true
        else
            return false
    } catch (error) {
        return false
    }
}