const fs = require('fs');

try {
    const raw = fs.readFileSync('next_data.json', 'utf8');
    const data = JSON.parse(raw);

    console.log('Printing full categories structure:');
    const categories = data.props.pageProps.contentData.categories;

    if (categories && categories.length > 0) {
        // Print first category with all its data
        console.log('\n=== First Category (Full) ===');
        console.log(JSON.stringify(categories[0], null, 2));

        console.log('\n=== All Category Titles ===');
        categories.forEach((cat, idx) => {
            console.log(`${idx}: ${cat.title} - ${cat.severity?.text || 'No severity'}`);
        });
    } else {
        console.log('Categories not found');
    }

} catch (e) {
    console.error(e);
}
