const fs = require('fs');
const csv = require('csv-parser');
const stringSimilarity = require('string-similarity');
const { v4: uuidv4 } = require('uuid');

const crosswalk = JSON.parse(fs.readFileSync('country_crosswalk.json', 'utf-8'));
const cleanClubs = JSON.parse(fs.readFileSync('clean_clubs.json', 'utf-8'));
const clubIdToName = {};
cleanClubs.forEach(c => {
  clubIdToName[String(c.club_id)] = c.clean_name;
  clubIdToName[String(c.club_id).replace('.0', '')] = c.clean_name;
});

function normalizeDOB(dobStr) {
  if (!dobStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) return dobStr;
  const parts = dobStr.split('/');
  if (parts.length === 3) {
    let m = parts[0]; let d = parts[1]; let y = parts[2];
    if (m.length === 1) m = '0' + m;
    if (d.length === 1) d = '0' + d;
    return `${y}-${m}-${d}`;
  }
  return dobStr;
}

function normalizePosition(pos) {
  if (!pos) return null;
  let p = pos.toUpperCase().trim();
  if (p === 'FW' || p === 'CF') return 'ST';
  const valid = ['GK', 'CB', 'RB', 'LB', 'CDM', 'CM', 'CAM', 'RM', 'LM', 'RW', 'LW', 'ST'];
  return valid.includes(p) ? p : null;
}

function normalizeFoot(foot) {
  if (!foot) return null;
  let f = foot.toUpperCase().trim();
  if (f === 'LEFT' || f === 'RIGHT' || f === 'BOTH') return f;
  return null;
}

function normalizeNationality(nat) {
  if (!nat) return null;
  if (crosswalk[nat]) return crosswalk[nat];
  return nat.toUpperCase();
}

function parseBoolean(val) {
  if (!val) return null;
  const lower = String(val).toLowerCase().trim();
  if (lower === 'true' || lower === 'yes' || lower === '1') return true;
  if (lower === 'false' || lower === 'no' || lower === '0') return false;
  return null;
}

function parseAliases(aliasesStr) {
  if (!aliasesStr) return [];
  try {
    // Try JSON parse, format might be "['Alias1', 'Alias2']"
    // Replace single quotes with double quotes
    const fixedStr = aliasesStr.replace(/'/g, '"');
    const parsed = JSON.parse(fixedStr);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    return [];
  }
  return [];
}

const records = [];

fs.createReadStream('RAW_ALL_PLAYERS.csv')
  .pipe(csv())
  .on('data', (row) => {
    const r = {};
    r.source_batch = row.source_batch || row.source;
    
    r.fullName = row.fullName || row.name || row.player_name;
    r.firstName = row.firstName || null;
    r.lastName = row.lastName || null;
    r.aliases = parseAliases(row.aliases);
    r.dob = normalizeDOB(row.date_of_birth || row.dob);
    r.nationality = normalizeNationality(row.nationality);
    r.heightCm = row.heightCm || row.height_cm ? parseInt(row.heightCm || row.height_cm) : null;
    r.preferredFoot = normalizeFoot(row.preferredFoot || row.preferred_foot);
    r.position = normalizePosition(row.mappedPosition || row.position);
    
    // Status
    r.isRetired = parseBoolean(row.isRetired || row.is_retired);
    if (row.current_status && typeof r.isRetired !== 'boolean') {
      const status = String(row.current_status).toLowerCase();
      if (status.includes('retired')) r.isRetired = true;
      if (status.includes('active')) r.isRetired = false;
    }
    
    // History & Current Club
    r.history = [];
    r.currentClub = null;
    
    if (row.current_club_if_active) {
      r.currentClub = row.current_club_if_active.trim();
    }
    
    if (row.linkedClubId) {
      const cname = clubIdToName[String(row.linkedClubId)];
      if (cname) {
        r.history.push({ club: cname, start_year: null, end_year: null });
        if (r.isRetired === false || r.isRetired === null) {
          r.currentClub = cname;
        }
      }
    }
    
    if (row.clubs_and_years) {
      const clubs = row.clubs_and_years.split(' / ');
      for (const c of clubs) {
        const match = c.match(/(.+?)\s+\((\d{4})-(present|\d{4})?\)/);
        if (match) {
          const endYear = match[3] === 'present' || !match[3] ? null : parseInt(match[3]);
          r.history.push({ club: match[1].trim(), start_year: parseInt(match[2]), end_year: endYear });
          if (endYear === null) r.currentClub = match[1].trim();
        } else {
          const match2 = c.match(/(.+?)\s+\((\d{4})\)/);
          if (match2) {
            r.history.push({ club: match2[1].trim(), start_year: parseInt(match2[2]), end_year: parseInt(match2[2]) });
          } else {
            r.history.push({ club: c.trim(), start_year: null, end_year: null });
          }
        }
      }
    }

    if (row.previous_clubs) {
      const clubs = row.previous_clubs.split(' / ');
      for (const c of clubs) {
        r.history.push({ club: c.trim(), start_year: null, end_year: null });
      }
    }

    if (row.club && row.years_active_at_club) {
      const match = row.years_active_at_club.match(/(\d{4})-(present|\d{4})?/);
      if (match) {
        const endYear = match[2] === 'present' || !match[2] ? null : parseInt(match[2]);
        r.history.push({ club: row.club.trim(), start_year: parseInt(match[1]), end_year: endYear });
        if (endYear === null) r.currentClub = row.club.trim();
      } else {
        r.history.push({ club: row.club.trim(), start_year: null, end_year: null });
      }
    } else if (row.club && row.joined_year) {
      r.history.push({ club: row.club.trim(), start_year: parseInt(row.joined_year), end_year: null });
      r.currentClub = row.club.trim();
    } else if (row.club && row.since) {
      r.history.push({ club: row.club.trim(), start_year: parseInt(row.since), end_year: null });
      r.currentClub = row.club.trim();
    } else if (row.club && ['phase2_current_squads_21clubs', 'al_ahly_manual'].includes(r.source_batch)) {
      // These batches are current squads, so this is their active club
      r.history.push({ club: row.club.trim(), start_year: null, end_year: null });
      r.currentClub = row.club.trim();
    }

    records.push(r);
  })
  .on('end', () => {
    fs.writeFileSync('parsed_records.json', JSON.stringify(records, null, 2));
    console.log(`Parsed ${records.length} records.`);
  });
