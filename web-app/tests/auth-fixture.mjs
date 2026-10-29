import { createServer } from "node:http";
import { createHash } from "node:crypto";
import {handleElectronicsRest} from "./electronics-store-fixture.mjs";
import {planCircuitBuild} from '../../supabase/functions/ohmi-ai/circuit-builder.ts';
import {buildEnv,mockGroq,memoryLedger} from './circuit-build-fixtures.mjs';

export const testUser = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated", role: "authenticated",
  email: "learner-a@example.test", email_confirmed_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "google", providers: ["google"] },
  user_metadata: { full_name: "Test Learner A" }, created_at: "2026-01-01T00:00:00Z",
};
export const otherUser = { ...testUser, id: "33333333-3333-4333-8333-333333333333", email: "learner-b@example.test", user_metadata: { full_name: "Test Learner B" } };
export const newUser = { ...testUser, id: "44444444-4444-4444-8444-444444444444", email: "new-learner@example.test", created_at: "2099-01-01T00:00:00Z" };
export const anotherNewUser = { ...newUser, id: "55555555-5555-4555-8555-555555555555", email: "another-new-learner@example.test" };
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
export function testSession(user = testUser, expired = false) {
  const expiresAt = Math.floor(Date.now() / 1000) + (expired ? -60 : 3600);
  return {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", exp: expiresAt })}.test-signature`,
    refresh_token: "test-refresh-" + user.id, token_type: "bearer", expires_in: 3600,
    expires_at: expiresAt, user,
  };
}
export async function seedSession(context, user = testUser, expired = false) {
  await context.addCookies([{ name: "ohmi-web-auth", value: "base64-" + encode(testSession(user, expired)), domain: "127.0.0.1", path: "/app/", sameSite: "Lax", httpOnly: false, secure: false }]);
}

// Isolated local Auth/Data API double. App code keeps its real Supabase verification path.
export async function startAuthFixture() {
  const state = { mode: "success", authorizations: 0, exchanges: 0, refreshes: 0, challenge: "", onboardingClaims: 0, onboardingFail: false };
  state.ai = null;
  const invited = new Set();
  const profiles = new Map();
  const server = createServer(async (request, response) => {
    if (state.delayMs) await new Promise(resolve => setTimeout(resolve, state.delayMs));
    (state.requests ||= []).push({ method: request.method, path: new URL(request.url, 'http://fixture').pathname });
    const url = new URL(request.url, "http://127.0.0.1:54329");
    response.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3115");
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Headers", request.headers["access-control-request-headers"] || "authorization,apikey,content-type,x-client-info,x-supabase-api-version,prefer,accept-profile,content-profile");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    const send = (status, data) => { response.writeHead(status, { "Content-Type": "application/json" }); response.end(data === undefined ? undefined : JSON.stringify(data)); };
    if (request.method === "OPTIONS") return send(204);
    let raw = "";
    for await (const chunk of request) raw += chunk;
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { return send(400, { message: "Invalid JSON" }); }
    const token = (request.headers.authorization || "").replace(/^Bearer /, "");
    let user;
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url"));
      if (token.endsWith(".test-signature")) user = [testUser, otherUser, newUser, anotherNewUser].find((u) => u.id === payload.sub);
    } catch {}
    if (url.pathname === "/auth/v1/authorize") {
      state.authorizations++;
      state.challenge = url.searchParams.get("code_challenge");
      const callback = new URL(url.searchParams.get("redirect_to"));
      if (url.searchParams.get("provider") !== "google" || !state.challenge || callback.href !== "http://127.0.0.1:3115/app/auth/callback/") return send(400, { message: "Unexpected OAuth configuration" });
      if (state.mode === "cancel") callback.searchParams.set("error", "access_denied");
      else callback.searchParams.set("code", state.mode === "error" ? "bad-code" : "test-code");
      response.writeHead(302, { Location: callback.href });
      return response.end();
    }
    if (url.pathname === "/auth/v1/token") {
      if (url.searchParams.get("grant_type") === "pkce") {
        state.exchanges++;
        const challenge = createHash("sha256").update(body.code_verifier || "").digest("base64url");
        if (body.auth_code !== "test-code" || challenge !== state.challenge) return send(400, { error: "invalid_grant", message: "Invalid PKCE code", code: "bad_code_verifier" });
        return send(200, testSession());
      }
      state.refreshes++;
      const owner = [testUser, otherUser].find((u) => body.refresh_token === "test-refresh-" + u.id);
      return owner ? send(200, testSession(owner)) : send(400, { message: "Invalid refresh token", code: "refresh_token_not_found" });
    }
    if (url.pathname === "/auth/v1/user") return user ? send(200, user) : send(401, { message: "Invalid session", code: "bad_jwt" });
    if (url.pathname === "/auth/v1/logout") return send(204);
    if (!user) return send(401, { message: "Sign in required" });
    if (url.pathname === "/rest/v1/rpc/ohmi_claim_onboarding") {
      state.onboardingClaims++;
      if (state.onboardingFail) return send(503, { message: "Status unavailable" });
      const eligible = Date.parse(user.created_at) >= Date.parse("2026-10-25T00:00:00Z");
      const claim = eligible && !invited.has(user.id);
      if (claim) invited.add(user.id);
      return send(200, claim);
    }
    if (url.pathname === "/rest/v1/ohmi_profiles") {
      const profile = profiles.get(user.id) || { id: user.id, display_name: user.user_metadata.full_name, language: "english" };
      if (request.method === "PATCH") { profiles.set(user.id, { ...profile, ...body }); return send(200, { id: user.id }); }
      return request.method === "GET" ? send(200, profile) : send(204);
    }
    if (state.ai) {
      const ai=state.ai;
      if (url.pathname === '/rest/v1/ohmi_conversations') return send(200,[{id:ai.conversationId,user_id:user.id,title:'Synthetic PDF conversation'}]);
      if (url.pathname === '/rest/v1/ohmi_messages') {
        const before = Number((url.searchParams.get('position') || '').replace('lt.', '')) || Infinity;
        return send(200,ai.messages.filter(m=>m.user_id===user.id && m.position < before).sort((a,b)=>b.position-a.position).slice(0,Number(url.searchParams.get('limit')) || 50));
      }
      if (url.pathname === '/rest/v1/ohmi_ai_requests') {
        const id=(url.searchParams.get('id')||'').replace('eq.','');
        return send(200,ai.jobs.filter(j=>j.id===id&&j.user_id===user.id));
      }
      if (url.pathname === '/functions/v1/ohmi-web') {
        if (ai.delayMs) await new Promise(resolve => setTimeout(resolve, ai.delayMs));
        ai.posts.push(body);
        if(body.operation==='circuit_build'&&ai.buildSpec){
          try{
            const value=await planCircuitBuild({body,userId:user.id,ledger:memoryLedger(ai.jobs,ai.messages),env:buildEnv,fetch:async(url,init)=>{
              ai.providerCalls=(ai.providerCalls||0)+1;ai.providerUrl=url;ai.providerBody=JSON.parse(init.body);
              if(ai.providerDelay)await new Promise(resolve=>setTimeout(resolve,ai.providerDelay));
              return mockGroq(ai.buildSpec,ai.buildOverride);
            }});
            return send(200,value);
          }catch(error){return send(error.status||503,{error:error.message});}
        }
        const result=ai.result || {status:'answer',answer:'Continued explanation from the original PDF.'};
        ai.jobs.push({id:body.requestId,user_id:user.id,status:'completed',operation:body.operation,language:body.language,model:'synthetic',result_payload:result,conversation_id:ai.conversationId,created_at:new Date().toISOString()});
        const position = Math.max(0, ...ai.messages.map(message => message.position || 0)) + 1;
        ai.messages.push({id:crypto.randomUUID(),user_id:user.id,role:'user',content:body.message,position}, {id:crypto.randomUUID(),user_id:user.id,role:'assistant',content:result.answer,structured_result:result,position:position+1});
        return send(200,{ok:true,requestId:body.requestId,accountId:user.id,result});
      }
    }
    if(await handleElectronicsRest({request,url,user,body,state,send}))return;
    if (url.pathname.startsWith("/rest/v1/")) return send(200, []);
    send(404, { message: "Fixture route not found" });
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(54329, "127.0.0.1", resolve); });
  return { state, close: () => new Promise((resolve) => server.close(resolve)) };
}
