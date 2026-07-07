module.exports=(err,req,res,next)=>{
    // logging the errors
    console.error(err);
    res.status(500).json({ "message": err.message });
}