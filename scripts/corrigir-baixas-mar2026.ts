/**
 * CORREÇÃO: Parcelas com baixa='S' indevido no PG – Pensionistas Março/2026
 *
 * Cruzamento confirmou: 123 parcelas têm baixa='S' no PostgreSQL
 * mas estão em aberto (baixa='') no MySQL legado.
 *
 * Ação: Atualizar baixa de 'S' → 'N' nessas parcelas,
 *       tornando-as visíveis no relatório de Débitos Pensionistas PG.
 *
 * Parcelas Grupo C (4 registros, R$ 1.245,91) NÃO são alteradas —
 * existem apenas no PG sem correspondência no MySQL.
 *
 * Gerado por: cruzar-baixas-mar2026.ts
 * Data: 01/03/2026
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const IDS_CORRIGIR = [
  'cml0242wd050hofbntz9d5f5j',
  'cml0249v705xpofbn7cvlrygm',
  'cml024p42080tofbn4oq3uy0t',
  'cml024oul07y1ofbnkpbl42ps',
  'cml028uli005jofmpv830y1vc',
  'cml023tnb03n3ofbn5h376qg7',
  'cml023k3v0235ofbnxdze1svl',
  'cml024hvs06r3ofbn9db6hlfy',
  'cml0246y605dsofbnx8a7tgk1',
  'cml024cc006bhofbnklkl6y6i',
  'cml0243s4059dofbn20qws50t',
  'cml029d7c00epofmpzc6pvmg3',
  'cml0241gs04szofbn9oybkj3c',
  'cml023xuw0413ofbnx92w5tto',
  'cml024pga0823ofbnrdwfmi6i',
  'cml023ack00n1ofbnqptzhpjo',
  'cml023bjo00v7ofbnnkz3hu8r',
  'cml0239zq00jbofbn2fxs5uws',
  'cml023d0l0133ofbntc06gm05',
  'cml023xr403zvofbnw10fwqi2',
  'cml023ajp00p5ofbn6u1p2du3',
  'cml023g3s01g0ofbnpy1ldwzd',
  'cml023tuv03pbofbno6fcyzf9',
  'cml023ozb02sdofbnvy3q7qkh',
  'cml023rrw03buofbnbyj1e8p5',
  'cml023hrs01osofbnd5cfhxis',
  'cml024ouk07xxofbnm64f23jf',
  'cml024oc307srofbng98nyuno',
  'cml024av1066iofbnn6su982u',
  'cml024ovi07yaofbnn39d0ifp',
  'cml024j1m06u5ofbni5f6rf28',
  'cml0242e204wdofbngeba2e6s',
  'cml0240e604imofbnuvlirlu8',
  'cml023r8g037nofbnauiq91wq',
  'cml024kao0769ofbno03j2v80',
  'cml0247kt05kdofbn3tii0x2l',
  'cml02935l007xofmpl7jw9dlx',
  'cml023ato00rzofbnm3z54qk9',
  'cml024iup06soofbnj5uy6xcm',
  'cml023o1b02meofbnibt8ouv5',
  'cml0238rz00d5ofbn3zv22uwx',
  'cml023bm100vxofbn1x8l91i6',
  'cml0238vq00e8ofbnmemwjyub',
  'cml023t5q03hxofbnxqoft0zi',
  'cml0242hi04xbofbn0qfcqd31',
  'cml0243in056xofbnye555q6z',
  'cml023a9q00m9ofbn71ul1hce',
  'cml0243jo0579ofbnpkitmcb4',
  'cml023rkb039nofbnwxer83v2',
  'cml023dgb0179ofbn971wix48',
  'cml023kzl0291ofbnmcac3z77',
  'cml029d6e00ehofmpelhusehb',
  'cml023qnu0325ofbnz4l6iqf2',
  'cml023llg02exofbntlapmcqu',
  'cml024kmb0790ofbnn9bibvnn',
  'cml023pg702x2ofbnyy44002a',
  'cml0247z105oiofbnji700ze1',
  'cml0240xl04obofbnavnpf9qf',
  'cml023cvu011mofbnxa06habc',
  'cml0236ie004lofbnk911t0tf',
  'cml0238sx00dfofbnf1v58zk2',
  'cml023e2j01brofbn55w0mms8',
  'cml0248yw05tbofbnb88sklmo',
  'cml024jyt072pofbn5qtucdgi',
  'cml023dlc018bofbnuhxtrrin',
  'cml0238tv00drofbn0nlbv48z',
  'cml0238yv00esofbngcy3chaj',
  'cml0294ks00c5ofmpj970kco0',
  'cml023uui03vxofbnppljkp5n',
  'cml029463009jofmpregzq6iv',
  'cml023fu101dlofbnihov70lp',
  'cml023ihg01vjofbnfwg8qn81',
  'cml023aao00mhofbn24siwwym',
  'cml02417k04r7ofbnnkso2hqq',
  'cml02404p04gjofbnrwtbo25i',
  'cml023lch02caofbnijvccxzv',
  'cml0243970546ofbn56aog3bl',
  'cml023lh902drofbn4emo3upm',
  'cml023iu101ypofbnmsx878hr',
  'cml023qmw031vofbn0yihrbks',
  'cml02471t05erofbnwbxp8rez',
  'cml023kjx025rofbnumn45ua2',
  'cml023y88044zofbnvhy0psom',
  'cml023dc80165ofbnj6nx8tgj',
  'cml023tp703npofbngyxje00n',
  'cml0247om05lhofbn3yyznlul',
  'cml02473r05ffofbn4mhkpktp',
  'cml023d5z014jofbnqo8ql2x4',
  'cml024n6x07pfofbn04jxt15t',
  'cml023o0u02m9ofbnyttg71dl',
  'cml0240om04lqofbnpcmtsf12',
  'cml023n2602knofbna84dm5c6',
  'cml024dam06k7ofbneq736fr1',
  'cml0239zb00j9ofbnpgu76fey',
  'cml023a3j00kfofbnjc3fb1ny',
  'cml023h8c01j7ofbn8i3xmgye',
  'cml023lot02fsofbn8vw2ssfj',
  'cml023juu020lofbnrwsoeixh',
  'cml023h3m01huofbntn3kcs6i',
  'cml023bmj00w2ofbnvumrah66',
  'cml0247ad05hbofbnydq3epa7',
  'cml024abd061jofbnsuew2hav',
  'cml023kql026dofbnomedaaac',
  'cml023ds1019cofbnaxamtq93',
  'cml023n0y02kfofbnruvcddrx',
  'cml0237670087ofbng9dm9fmb',
  'cml024m0607dvofbnfmpp3myr',
  'cml023zxl04efofbnqmfkwfqd',
  'cml023amy00q1ofbn5hde4pmh',
  'cml024cmf06egofbnfejjpgtq',
  'cml023dgs017dofbndco9p9j2',
  'cml023qwc034iofbnmtu4pc0p',
  'cml0236qv006zofbnoebnhxhh',
  'cml029d2b00drofmp8j1id51k',
  'cml023aj600oxofbncyzqsur0',
  'cml023pj102xxofbnheeenvk3',
  'cml023kll025tofbnm3uqns4a',
  'cml023kxo028eofbnk00xik18',
  'cml023fbc01c4ofbnwgewhlv5',
  'cml024b3l068yofbnzokmz189',
  'cml023rtb03c9ofbnwn4g12tq',
  'cml0238ku00b3ofbn8maly29p',
  'cml023mxl02jjofbnab8qgccf',
];

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  CORREÇÃO baixa=S → N – Pensionistas Março/2026');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Verificar estado atual antes de corrigir
  const antes = await prisma.parcela.aggregate({
    where: { id: { in: IDS_CORRIGIR } },
    _sum: { valor: true },
    _count: true,
  });

  console.log(`📋 Parcelas a corrigir: ${antes._count}  |  Soma: R$ ${Number(antes._sum.valor ?? 0).toFixed(2)}`);

  if (antes._count !== IDS_CORRIGIR.length) {
    console.warn(`⚠️  Atenção: esperado ${IDS_CORRIGIR.length} registros, encontrado ${antes._count}. Alguns IDs podem não existir.`);
  }

  // Aplicar correção: baixa='S' → 'N'
  const resultado = await prisma.parcela.updateMany({
    where: {
      id: { in: IDS_CORRIGIR },
      baixa: { in: ['S', 'X', 'B'] }, // segurança extra: só corrige se realmente estava marcada
    },
    data: {
      baixa: 'N',
      updatedAt: new Date(),
    },
  });

  console.log(`\n✅ Parcelas atualizadas: ${resultado.count}  (baixa: S/X/B → N)`);

  // Verificar novo total em aberto para Mar/2026
  const dataInicio = new Date(2026, 2, 1, 0, 0, 0);
  const dataFim    = new Date(2026, 2, 31, 23, 59, 59, 999);

  const depois = await prisma.parcela.count({
    where: {
      dataVencimento: { gte: dataInicio, lte: dataFim },
      OR: [{ baixa: null }, { baixa: '' }, { baixa: ' ' }, { baixa: 'N' }],
      venda: { socio: { codTipo: { in: [3, 4] } } },
    },
  });

  const somaDepois = await prisma.parcela.aggregate({
    where: {
      dataVencimento: { gte: dataInicio, lte: dataFim },
      OR: [{ baixa: null }, { baixa: '' }, { baixa: ' ' }, { baixa: 'N' }],
      venda: { socio: { codTipo: { in: [3, 4] } } },
    },
    _sum: { valor: true },
  });

  console.log(`\n📊 Novo total PG – Pensionistas em aberto (03/2026):`);
  console.log(`   ${depois} parcelas  |  R$ ${Number(somaDepois._sum.valor ?? 0).toFixed(2)}`);
  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
