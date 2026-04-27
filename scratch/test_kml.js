const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
	<name>Valais updated 2.kml</name>
	<Folder>
		<name>Valais</name>
		<Folder id="FeatureLayer4">
			<name>Bills</name>
			<Placemark id="ID_40000">
				<name>Placemark</name>
				<coordinates>1,1,0 2,2,0</coordinates>
			</Placemark>
			<Placemark id="ID_40001">
				<name>Another</name>
				<coordinates>3,3,0 4,4,0</coordinates>
			</Placemark>
		</Folder>
        <Placemark>
            <name>Standalone</name>
            <coordinates>5,5,0 6,6,0</coordinates>
        </Placemark>
	</Folder>
</Document>
</kml>`;

const { JSDOM } = require('jsdom');
const dom = new JSDOM(kml, { contentType: 'application/xml' });
const doc = dom.window.document;

function kmlTags(el, tag) {
  return Array.from(el.getElementsByTagName(tag));
}

function kmlText(el, tag) {
  // Only look at direct children to avoid picking up nested name/description
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (child.nodeType === 1 && child.tagName.toLowerCase() === tag.toLowerCase()) {
      return child.textContent.trim();
    }
  }
  return null;
}

function getBestName(pm) {
    let name = kmlText(pm, 'name');
    
    // If name is null or "Placemark" (case insensitive), look at parents
    if (!name || name.toLowerCase() === 'placemark') {
        let parent = pm.parentElement;
        while (parent) {
            const parentName = kmlText(parent, 'name');
            if (parentName && parentName.toLowerCase() !== 'placemark') {
                return parentName;
            }
            parent = parent.parentElement;
        }
    }
    return name || 'Unnamed Paddock';
}

const placemarks = kmlTags(doc, 'Placemark');
placemarks.forEach(pm => {
    console.log('Original name:', kmlText(pm, 'name'));
    console.log('Resolved name:', getBestName(pm));
});
