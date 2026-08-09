import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * No Next 16 o antigo `middleware` passou a se chamar `proxy` e roda no
 * runtime Node (edge nao e suportado aqui).
 *
 * Responsabilidades:
 *   1. renovar o token do Supabase a cada navegacao;
 *   2. barrar rota privada para quem nao esta autenticado.
 *
 * A checagem aqui e otimista. Cada pagina protegida confirma a sessao por
 * conta propria — proxy nao substitui autorizacao.
 */

const ROTAS_PUBLICAS = ["/login", "/auth"];
const INICIO = "/home";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser revalida o token no servidor; getSession apenas le o cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const ehPublica = ROTAS_PUBLICAS.some((rota) => pathname.startsWith(rota));

  // nao existe pagina na raiz: ela so encaminha para o lugar certo
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = user ? INICIO : "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!user && !ehPublica) {
    // API responde 401: redirecionar devolveria o HTML do login e quebraria
    // o .json() do cliente com um erro que nao explica nada.
    if (pathname.startsWith("/api/")) {
      return Response.json({ erro: "nao autenticado" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("proximo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = INICIO;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // tudo, menos estaticos e imagens
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
