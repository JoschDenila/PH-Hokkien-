let allRows = []; // Store all data for filtering
let processedRows = []; // Store pre-processed search data
let rowElements = []; // Cache DOM elements
let searchIndex = new Map(); // Inverted index for O(1) lookups
let currentDisplayedRows = new Set(); // Track currently displayed rows

async function loadIntoTable(url, table){
    const tableHead = table.querySelector("thead");
    const tableBody = table.querySelector("tbody");
    const response = await fetch(url);
    const  { headers, rows } = await response.json();

    // Store all rows for search functionality
    allRows = rows;

    // Pre-process data for faster searching
    preprocessData();

    // Build search index
    buildSearchIndex();

    tableHead.innerHTML = "<tr></tr>";
    tableBody.innerHTML = "";

    for (const headerText of headers) {
        const headerElement = document.createElement("th");
        
        headerElement.textContent = headerText;
        tableHead.querySelector("tr").appendChild(headerElement);
    }

    // Initial load - show all rows
    displayRowsOptimized(rows, tableBody);
}

function preprocessData() {
    processedRows = allRows.map((row, index) => ({
        originalIndex: index,
        normalizedCells: row.map(cell => removeDiacritics(cell.toLowerCase())),
        searchText: removeDiacritics(row.join(' ').toLowerCase())
    }));
}

function buildSearchIndex() {
    searchIndex.clear();
    
    processedRows.forEach((processedRow, index) => {
        // Create n-grams for faster partial matching
        const words = processedRow.searchText.split(/\s+/);
        
        words.forEach(word => {
            // Index full words
            if (!searchIndex.has(word)) {
                searchIndex.set(word, new Set());
            }
            searchIndex.get(word).add(index);
            
            // Index prefixes for faster prefix matching
            for (let i = 1; i <= word.length && i <= 10; i++) {
                const prefix = word.substring(0, i);
                if (!searchIndex.has(prefix)) {
                    searchIndex.set(prefix, new Set());
                }
                searchIndex.get(prefix).add(index);
            }
        });
    });
}

function displayRowsOptimized(rows, tableBody) {
    const fragment = document.createDocumentFragment();
    
    // Clear existing elements efficiently
    tableBody.innerHTML = "";
    rowElements = [];
    currentDisplayedRows.clear();
    
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowElement = document.createElement("tr");
        
        for (const cellText of row){
            const cellElement = document.createElement("td");
            cellElement.textContent = cellText;
            rowElement.appendChild(cellElement);
        }
        
        fragment.appendChild(rowElement);
        rowElements.push(rowElement);
        currentDisplayedRows.add(i);
    }
    
    // Single DOM operation
    tableBody.appendChild(fragment);
}

// Virtual scrolling for very large datasets
function displayRowsVirtual(rows, tableBody, startIndex = 0, endIndex = Math.min(100, rows.length)) {
    const fragment = document.createDocumentFragment();
    tableBody.innerHTML = "";
    rowElements = [];
    
    for (let i = startIndex; i < endIndex; i++) {
        const row = rows[i];
        const rowElement = document.createElement("tr");
        
        for (const cellText of row){
            const cellElement = document.createElement("td");
            cellElement.textContent = cellText;
            rowElement.appendChild(cellElement);
        }
        
        fragment.appendChild(rowElement);
        rowElements.push(rowElement);
    }
    
    tableBody.appendChild(fragment);
}

function removeDiacritics(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Debounced search to avoid excessive calls
let searchTimeout;
function debouncedSearch(searchTerm) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchTableOptimized(searchTerm);
    }, 150); // 150ms debounce
}

function searchTableOptimized(searchTerm) {
    const tableBody = document.querySelector("tbody");
    
    if (!searchTerm.trim()) {
        // If search is empty, show all rows
        displayRowsOptimized(allRows, tableBody);
        return;
    }
    
    const normalizedSearchTerm = removeDiacritics(searchTerm.toLowerCase());
    const searchWords = normalizedSearchTerm.split(/\s+/).filter(word => word.length > 0);
    
    if (searchWords.length === 0) {
        displayRowsOptimized(allRows, tableBody);
        return;
    }
    
    // Use search index for O(1) lookups
    let candidateRows = null;
    
    for (const word of searchWords) {
        const matchingRowIndices = new Set();
        
        // Find all index entries that contain this word (prefix matching)
        for (const [indexKey, rowIndices] of searchIndex) {
            if (indexKey.includes(word)) {
                rowIndices.forEach(idx => matchingRowIndices.add(idx));
            }
        }
        
        if (candidateRows === null) {
            candidateRows = matchingRowIndices;
        } else {
            // Intersection for AND logic
            candidateRows = new Set([...candidateRows].filter(x => matchingRowIndices.has(x)));
        }
        
        // Early exit if no matches
        if (candidateRows.size === 0) break;
    }
    
    // Convert indices back to actual rows
    const filteredRows = candidateRows ? 
        [...candidateRows].map(index => allRows[processedRows[index].originalIndex]) : 
        [];
    
    displayRowsOptimized(filteredRows, tableBody);
}

// Alternative: Simple hash-based search for exact matches
function searchTableHash(searchTerm) {
    const tableBody = document.querySelector("tbody");
    
    if (!searchTerm.trim()) {
        displayRowsOptimized(allRows, tableBody);
        return;
    }
    
    const normalizedSearchTerm = removeDiacritics(searchTerm.toLowerCase());
    
    // Use Set for O(1) lookups
    const matchingIndices = searchIndex.get(normalizedSearchTerm) || new Set();
    const filteredRows = [...matchingIndices].map(index => 
        allRows[processedRows[index].originalIndex]
    );
    
    displayRowsOptimized(filteredRows, tableBody);
}

// Initialize the table
loadIntoTable("PH.json", document.querySelector("table"));

// Add event listener for search input with debouncing
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.querySelector('.search-input');
    
    searchInput.addEventListener('input', function(e) {
        debouncedSearch(e.target.value);
    });
    
    // Optional: Add keyboard shortcuts for faster navigation
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            e.target.value = '';
            displayRowsOptimized(allRows, document.querySelector("tbody"));
        }
    });
});