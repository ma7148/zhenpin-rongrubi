import XLSX from 'xlsx';
import mammoth from 'mammoth';

const filename = '范湖万达店管理层荣辱榜.docx';

function extractStoreFromFilename(filename) {
  const storePatterns = [
    '南京路店', '汉街店', '汉街精选店', '江腾广场店', '范湖万达店',
    '钟家村店', '青山印象城店', '凯德店', '杨家湾店', '万象城店',
    '武汉天地店', '万科店', '融侨华府店', '永旺店', '王家湾店'
  ];
  for (const store of storePatterns) {
    const keyword = store.replace('店', '');
    console.log(`  Checking: "${keyword}" in "${filename}" -> ${filename.includes(keyword)}`);
    if (filename.includes(keyword)) return store;
  }
  return '';
}

const result = extractStoreFromFilename(filename);
console.log('Result:', result);
