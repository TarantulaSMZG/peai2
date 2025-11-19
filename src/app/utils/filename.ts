const padZero = (num: number): string => num.toString().padStart(2, '0');

export const generateFilename = (protocolNumber: string, step: 'parsed' | 'analyzed' | 'insights' | 'filtered' | 'search'): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = padZero(now.getMonth() + 1);
    const day = padZero(now.getDate());
    const hours = padZero(now.getHours());
    const minutes = padZero(now.getMinutes());
    const seconds = padZero(now.getSeconds());

    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hours}-${minutes}-${seconds}`;
    
    const sanitizedProtocolNumber = protocolNumber.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');

    return `wp${sanitizedProtocolNumber}-${step}-${dateStr}-${timeStr}`;
};
