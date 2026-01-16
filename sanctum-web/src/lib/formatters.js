export const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-AU', { 
        style: 'currency', 
        currency: 'AUD' 
    }).format(val || 0);
};

export const formatDate = (d) => {
    return d ? new Date(d).toLocaleDateString() : 'N/A';
};

export const formatDateTime = (d) => {
    return d ? new Date(d).toLocaleString() : 'N/A';
};