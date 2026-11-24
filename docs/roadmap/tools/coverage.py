import re
import json, subprocess, sys
# key -> id from the index source itself, so explicit lettered ids (S-011b, S-254b, ...) and suffixes are right
import os
# key -> the issue ids that build it (split parts and added steps included), from the index source and the step files
m=json.loads(subprocess.check_output([sys.executable,'step-index-src.py','issues'],cwd=os.path.dirname(os.path.abspath(__file__)),stderr=subprocess.DEVNULL))
def ids(ks): return ', '.join(i for k in ks.split() for i in m[k])
rows=[
('Lands (overworld)', [('Duskwick','ccRecipe ccKit ccArt ccFinds wicks ccEnemies ch8'),('Pinewhistle','pwRecipe pwKit pwArt pwPeople pwEnemies pwFinds pwQuest'),('Archwater','awRecipe awKit awArt awPeople awEnemies awFinds awQuest'),('Threemills','tmRecipe tmKit tmArt tmPeople tmEnemies tmFinds tmQuest'),('The Rootdeep','rdRecipe rdKit rdArt rdPeople rdEnemies rdFinds ch13'),('The Glassway','gwRecipe gwKit gwArt ch14 gwEnemies gwFinds'),('Kettle Isle','kiRecipe kiKit kiArt kiPeople kiEnemies kiFinds kiQuest'),('Saltglass Flats','sgRecipe sgKit sgArt sgPeople sgEnemies sgFinds sgQuest'),('Driftholm','dhRecipe dhKit starstair dhArt dhLife dhFinds'),('The Starmeadow','smRecipe smKit starkin smEnemies ch19'),('The Crown','crown')]),
('Variant realms', [('Remembered Isle','variant young knots'),('Moonmere','moonmere ss47'),('Hundred-Year Night','night ch22 letter'),("Hoot's Margins",'margins ss52'),('Guardian Dreams','dreams dreams2 dreams3 dreams4')]),
('Dungeons', [('d1 Under the Roots','utr1 utr2 rollo'),('d2 Whistlehollow','wh1 wh2 mossmantle'),('d3 Undertow Grotto','ug1 ug2 gloop'),('d4 Granary Vaults','gv1 gv2 honks'),("d5 Lamplighters' Tower",'tower1 tower2 wickwork'),('d6 Rootdeep Heart','rh1 rh2 lumbra'),('d7 Sunken Bell','bell1 bell2 pelagia'),("d8 Kettle's Belly",'kb1 kb2 fumarole'),('d9 Buried Academy','ba1 ba2 exam1 exam2'),('d10 Spiral Stair','ss1 ss2 chase'),('d11 Ladder of Lights','lad1 lad2 lad3 fin1 fin2 fin3'),('o1 Snowglobe','snow1 flurry'),("o2 Grumble's Undercap",'undercap1 ss11'),('o3 Merry Mabel','mabel'),('o4 Hundred Lamps','lamps1 lamps2 jamboree'),('24 Hollows','hollows ccHollows pwHollows awHollows tmHollows rdHollows gwHollows kiHollows sgHollows dhFinds')]),
('Tools', [('Glowbud Lantern','lantern'),('Leaf Glider','glider'),('Tide Bell','tideBell'),('Thistle Hook','hook'),('Sunglass','sunglass acorns'),('Digging Paws','mitts'),('Starsong','starsong'),('Ember Sling','sling'),('Ivy Gloves','gloves'),('Cloudstep','cloudstep'),('the Dandelion','jetty sailing boat1 boat2'),('Starsteel / thornvine / thornglass','thorns starsteel')]),
('Story beats', [('I.1-I.5','shellby boughs layers heal handover1 handover2 memlines'),('I.6','horizon wennaVoice I6'),('ch7','ch7 jetty'),('ch8','mote ch8'),('ch9-11 + II.M','pwQuest awQuest tmQuest IIM'),('ch12','ch12'),('ch13','ch13'),('ch14','ch14'),('ch15-17','stones kiQuest sgQuest mem1012'),('ch18','starstair chase ch18'),('ch19-21','ch19 lad1 crown fin1 fin2 fin3'),('ch22','night ch22 letter')]),
('Systems', [('Journal, quests, hints','F13 scenes F15 F16 lore'),('Collections and completion','save9 hearts hollows F25 logs vistas acorns'),('Travel','F24 sailing rootgates boat1 boat2 starstair'),('Economy','econ kinako works furnish trims stock plushies'),('Activities (12)','dash vistas fish1 ss06 actHome actAw actTm ss36 ss41')]),
]
if len(sys.argv) > 2 and sys.argv[1] == '--count':
    print(len({i for g,items in rows if g == sys.argv[2] for n,k in items for kk in k.split() for i in m[kk]}))
    raise SystemExit
print('## Appendix A: canon coverage (where each canon item is built)\n')
for g,items in rows:
    print(f'**{g}.** ' + ' · '.join(f'{n}: {ids(k)}' for n,k in items) + '\n')
