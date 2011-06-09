require 'erb'

namespace :erb do
  desc "Regenerate test/*.html from html/*.html.erb"
  task :generate do
    Dir.glob('html/*.html.erb').each do |filename|
      file = File.open(filename)
      template = ERB.new(file.read())
      result = template.result
      filename.match(/\/([-_\w\d]+.html).erb/)
      output_filename = "test/#{$1}"
      output_file = File.open(output_filename, "w")
      output_file << result
      output_file.close()
    end    
  end
end

desc "Generate single register.js for distribution"
task :dist do
  output_file = File.open("register.js", "w")
  # Order is important - register-util is needed before register-core...
  %w{ register-util.js register-core.js register-ledger.js register-ui.js }.each_with_index do |file_name, i|
    file = File.open("src/#{file_name}")
    source = file.readlines
    source.shift unless i == 0 # shift off the copyright
    output_file << source 
    output_file << "\n"  
  end
  output_file.close
end
