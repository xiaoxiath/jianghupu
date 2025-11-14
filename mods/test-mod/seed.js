// mods/test-mod/seed.ts
async function seed(db) {
  console.log("Running seeder for test-mod...");
  await db.faction.upsert({
    where: { name: "\u900D\u9065\u6D3E" },
    update: {},
    create: {
      name: "\u900D\u9065\u6D3E",
      alignment: "\u4E2D\u7ACB",
      reputation: 900,
      description: "\u9057\u4E16\u72EC\u7ACB\uFF0C\u98D8\u7136\u51FA\u5C18\u3002\u6D3E\u5185\u6B66\u5B66\u8BB2\u7A76\u8F7B\u7075\u98D8\u9038\uFF0C\u975E\u6709\u7F18\u8005\u4E0D\u5F97\u800C\u5165\u3002"
    }
  });
  console.log("test-mod seeder finished.");
}
export {
  seed
};
