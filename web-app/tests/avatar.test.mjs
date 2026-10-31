import test from "node:test";
import assert from "node:assert/strict";
import {
  validateAvatarId,
  ALLOWED_AVATAR_IDS,
} from "../src/lib/backend/guards.mjs";
import {
  AVATARS,
  AVATAR_IDS,
  getAvatar,
  isValidAvatarId,
  resolveAvatarSrc,
} from "../src/lib/avatars.ts";
import { startAuthFixture, testUser, testSession } from "./auth-fixture.mjs";

test("ALLOWED_AVATAR_IDS matches all 10 custom OHMI mascots exactly", () => {
  assert.equal(ALLOWED_AVATAR_IDS.length, 10);
  assert.deepEqual([...ALLOWED_AVATAR_IDS], [
    "cowboy",
    "engineer",
    "professor",
    "astronaut",
    "gamer",
    "detective",
    "scientist",
    "ninja",
    "pilot",
    "royal",
  ]);
  assert.deepEqual([...AVATAR_IDS], [...ALLOWED_AVATAR_IDS]);
});

test("validateAvatarId allows all 10 valid avatars and trims/normalizes casing", () => {
  for (const id of ALLOWED_AVATAR_IDS) {
    assert.equal(validateAvatarId(id), id);
    assert.equal(validateAvatarId(` ${id.toUpperCase()} `), id);
  }
});

test("validateAvatarId allows empty, null, or undefined as fallback to initial", () => {
  assert.equal(validateAvatarId(""), "");
  assert.equal(validateAvatarId(null), "");
  assert.equal(validateAvatarId(undefined), "");
});

test("validateAvatarId strictly rejects unauthorized, malicious, or invalid inputs", () => {
  const invalidInputs = [
    "unknown",
    "admin",
    "../cowboy",
    "cowboy.png",
    "cowboy/test",
    "<script>",
    "hack",
    123,
    true,
    {},
    [],
  ];
  for (const invalid of invalidInputs) {
    assert.throws(
      () => validateAvatarId(invalid),
      /Choose a valid OHMI mascot avatar\./,
      `Should reject input: ${JSON.stringify(invalid)}`,
    );
  }
});

test("AVATARS registry is fully populated with 10 mascots, metadata, and webp/png paths", () => {
  assert.equal(AVATARS.length, 10);
  for (const item of AVATARS) {
    assert.ok(item.id, "avatar must have an id");
    assert.ok(item.name.includes("OHMI"), "avatar name must include OHMI");
    assert.ok(item.role.length > 0, "avatar must have a role");
    assert.ok(item.description.length > 0, "avatar must have a description");
    assert.equal(item.src, `/app/avatars/${item.id}.webp`);
    assert.equal(item.pngSrc, `/app/avatars/${item.id}.png`);
  }
});

test("getAvatar and isValidAvatarId return correct items or undefined", () => {
  assert.equal(isValidAvatarId("cowboy"), true);
  assert.equal(isValidAvatarId("invalid"), false);
  assert.equal(isValidAvatarId(""), false);

  const cowboy = getAvatar("cowboy");
  assert.equal(cowboy?.name, "Cowboy OHMI");
  assert.equal(resolveAvatarSrc("cowboy"), "/app/avatars/cowboy.webp");

  assert.equal(getAvatar("invalid"), undefined);
  assert.equal(resolveAvatarSrc("invalid"), undefined);
  assert.equal(getAvatar(""), undefined);
  assert.equal(getAvatar(null), undefined);
});

test("profile avatar persists in auth/database double and round-trips correctly", async () => {
  const fixture = await startAuthFixture();
  try {
    const session = testSession(testUser);
    const token = `Bearer ${session.access_token}`;

    // 1. Initial profile get
    const getRes = await fetch("http://127.0.0.1:54329/rest/v1/ohmi_profiles", {
      headers: { Authorization: token },
    });
    assert.equal(getRes.status, 200);
    const initialProfile = await getRes.json();
    assert.equal(initialProfile.avatar, "");

    // 2. Update avatar to astronaut
    const patchRes = await fetch("http://127.0.0.1:54329/rest/v1/ohmi_profiles", {
      method: "PATCH",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ avatar: "astronaut" }),
    });
    assert.equal(patchRes.status, 200);

    // 3. Verify updated avatar persists
    const verifyRes = await fetch("http://127.0.0.1:54329/rest/v1/ohmi_profiles", {
      headers: { Authorization: token },
    });
    assert.equal(verifyRes.status, 200);
    const updatedProfile = await verifyRes.json();
    assert.equal(updatedProfile.avatar, "astronaut");
    assert.equal(updatedProfile.display_name, testUser.user_metadata.full_name);

    // 4. Update back to empty fallback
    await fetch("http://127.0.0.1:54329/rest/v1/ohmi_profiles", {
      method: "PATCH",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ avatar: "" }),
    });

    const fallbackRes = await fetch("http://127.0.0.1:54329/rest/v1/ohmi_profiles", {
      headers: { Authorization: token },
    });
    const fallbackProfile = await fallbackRes.json();
    assert.equal(fallbackProfile.avatar, "");
  } finally {
    await fixture.close();
  }
});
